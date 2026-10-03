/* ============================================================
   IMAGE PIPELINE (runs in a Web Worker and on the main thread)
   ============================================================ */
// Phones and tablets get far less memory per tab than computers; iPhone Safari
// reloads the page when it runs out, losing what's on screen.
var LOWMEM = (function() {
  try {
    var n = navigator;
    return /iPhone|iPad|iPod|Android/i.test(n.userAgent) || n.platform === 'MacIntel' && n.maxTouchPoints > 1 || !!n.deviceMemory && n.deviceMemory <= 4
  } catch (e) {
    return false
  }
})();

function PIPE() {
  var C = function(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v
  };
  var L = function(r, g, b) {
    return .2126 * r + .7152 * g + .0722 * b
  };
  var ss = function(a, b, x) {
    x = (x - a) / (b - a);
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    return x * x * (3 - 2 * x)
  };
  var mk = function(w, h) {
    return {
      w: w,
      h: h,
      d: new Uint8ClampedArray(w * h * 4)
    }
  };
  var cp = function(m) {
    return {
      w: m.w,
      h: m.h,
      d: new Uint8ClampedArray(m.d)
    }
  };

  function hash(i) {
    i |= 0;
    i = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
    i = Math.imul(i ^ (i >>> 16), 0x45d9f3b);
    i ^= i >>> 16;
    return (i >>> 0) / 4294967296
  }

  /* ---- geometry: quarter turns, flips, straighten and crop as one affine map ---- */
  // Returns the output size and the matrix mapping output pixel coordinates to
  // source pixel coordinates: sx = a*x + c*y + e, sy = b*x + d*y + f.
  // g = {rot, fh, fv, ang (straighten degrees, + is clockwise), crop ('4:5' ratio,
  // centered) or rect ({x,y,w,h} as fractions of the straightened frame)}.
  function mmul(A, B) {
    return [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]]
  }

  function straightFrame(wi, hi, ang) {
    var t = Math.abs(ang || 0) * Math.PI / 180,
      c = Math.cos(t),
      s = Math.sin(t),
      k = Math.min(wi / (wi * c + hi * s), hi / (wi * s + hi * c));
    return t ? [wi * k, hi * k] : [wi, hi]
  }

  function geoMap(w, h, g) {
    g = g || {};
    var q = ((((g.rot || 0) % 360) + 360) % 360) / 90,
      wi = q % 2 ? h : w,
      hi = q % 2 ? w : h,
      // intermediate (rotated + flipped) -> source
      M = q === 1 ? [0, -1, 1, 0, 0, h] : q === 2 ? [-1, 0, 0, -1, w, h] : q === 3 ? [0, 1, -1, 0, w, 0] : [1, 0, 0, 1, 0, 0];
    M = mmul(M, [g.fh ? -1 : 1, 0, 0, g.fv ? -1 : 1, g.fh ? wi : 0, g.fv ? hi : 0]);
    var fr = straightFrame(wi, hi, g.ang),
      ws = fr[0],
      hs = fr[1];
    if (g.ang) {
      var t = -g.ang * Math.PI / 180,
        c = Math.cos(t),
        s = Math.sin(t);
      // straightened frame -> intermediate: rotate about the centres
      M = mmul(M, [c, s, -s, c, wi / 2 - c * ws / 2 + s * hs / 2, hi / 2 - s * ws / 2 - c * hs / 2])
    }
    var x0 = 0,
      y0 = 0,
      ow = Math.round(ws),
      oh = Math.round(hs);
    if (g.rect) {
      x0 = Math.round(g.rect.x * ws);
      y0 = Math.round(g.rect.y * hs);
      ow = Math.max(1, Math.min(Math.round(ws) - x0, Math.round(g.rect.w * ws)));
      oh = Math.max(1, Math.min(Math.round(hs) - y0, Math.round(g.rect.h * hs)))
    } else if (g.crop) {
      var p = g.crop.split(':').map(Number),
        r = p[0] / p[1],
        W0 = Math.round(ws),
        H0 = Math.round(hs),
        cw = W0,
        ch = Math.round(W0 / r);
      if (ch > H0) {
        ch = H0;
        cw = Math.round(H0 * r)
      }
      x0 = (W0 - cw) >> 1;
      y0 = (H0 - ch) >> 1;
      ow = cw;
      oh = ch
    }
    M = mmul(M, [1, 0, 0, 1, x0, y0]);
    return {
      w: ow,
      h: oh,
      m: M,
      frame: [ws, hs],
      smooth: !!g.ang
    }
  }

  function geo(m, g) {
    if (!g || !(g.rot % 360 || g.fh || g.fv || g.ang || g.crop || g.rect)) return m;
    var G = geoMap(m.w, m.h, g),
      A = G.m,
      w = m.w,
      h = m.h,
      o = mk(G.w, G.h),
      sd = m.d,
      od = o.d;
    if (!G.smooth) {
      // Axis-aligned: copy pixels exactly (nearest neighbour).
      var s32 = new Uint32Array(sd.buffer, sd.byteOffset, w * h),
        o32 = new Uint32Array(od.buffer);
      for (var y = 0; y < G.h; y++)
        for (var x = 0; x < G.w; x++) {
          var sx = Math.floor(A[0] * (x + .5) + A[2] * (y + .5) + A[4]),
            sy = Math.floor(A[1] * (x + .5) + A[3] * (y + .5) + A[5]);
          o32[y * G.w + x] = s32[sy * w + sx]
        }
      return o
    }
    for (var y2 = 0; y2 < G.h; y2++)
      for (var x2 = 0; x2 < G.w; x2++) {
        var u = A[0] * (x2 + .5) + A[2] * (y2 + .5) + A[4] - .5,
          v = A[1] * (x2 + .5) + A[3] * (y2 + .5) + A[5] - .5;
        u = u < 0 ? 0 : u > w - 1 ? w - 1 : u;
        v = v < 0 ? 0 : v > h - 1 ? h - 1 : v;
        var ix = Math.min(w - 2, u | 0),
          iy = Math.min(h - 2, v | 0),
          fx = u - ix,
          fy = v - iy,
          i00 = (iy * w + ix) * 4,
          i10 = i00 + 4,
          i01 = i00 + w * 4,
          i11 = i01 + 4,
          oi = (y2 * G.w + x2) * 4;
        if (ix < 0) {
          ix = 0;
          fx = 0
        }
        for (var k = 0; k < 3; k++) od[oi + k] = (sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx) * (1 - fy) + (sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx) * fy;
        od[oi + 3] = 255
      }
    return o
  }

  function lum(m) {
    var n = m.w * m.h,
      o = new Float32Array(n),
      d = m.d;
    for (var p = 0, i = 0; p < n; p++, i += 4) o[p] = L(d[i], d[i + 1], d[i + 2]);
    return o
  }

  function boxH(s, t, w, h, r) {
    var k = 1 / (2 * r + 1);
    for (var y = 0; y < h; y++) {
      var o = y * w,
        a = 0;
      for (var i = -r - 1; i < r; i++) a += s[o + Math.min(w - 1, Math.max(0, i))];
      for (var x = 0; x < w; x++) {
        a += s[o + Math.min(w - 1, x + r)] - s[o + Math.max(0, x - r - 1)];
        t[o + x] = a * k
      }
    }
  }

  function boxV(s, t, w, h, r) {
    var k = 1 / (2 * r + 1);
    for (var x = 0; x < w; x++) {
      var a = 0;
      for (var i = -r - 1; i < r; i++) a += s[Math.min(h - 1, Math.max(0, i)) * w + x];
      for (var y = 0; y < h; y++) {
        a += s[Math.min(h - 1, y + r) * w + x] - s[Math.max(0, y - r - 1) * w + x];
        t[y * w + x] = a * k
      }
    }
  }

  function blur1(s, w, h, r) {
    var a = Float32Array.from(s);
    if (r < 1) return a;
    var b = new Float32Array(s.length),
      rr = Math.max(1, Math.round(r / 1.7));
    for (var p = 0; p < 3; p++) {
      boxH(a, b, w, h, rr);
      boxV(b, a, w, h, rr)
    }
    return a
  }

  function blurRGB(m, r) {
    var w = m.w,
      h = m.h,
      n = w * h,
      d = m.d,
      R = new Float32Array(n),
      G = new Float32Array(n),
      B = new Float32Array(n);
    for (var p = 0, i = 0; p < n; p++, i += 4) {
      R[p] = d[i];
      G[p] = d[i + 1];
      B[p] = d[i + 2]
    }
    R = blur1(R, w, h, r);
    G = blur1(G, w, h, r);
    B = blur1(B, w, h, r);
    var o = mk(w, h),
      od = o.d;
    for (p = 0, i = 0; p < n; p++, i += 4) {
      od[i] = R[p];
      od[i + 1] = G[p];
      od[i + 2] = B[p];
      od[i + 3] = 255
    }
    return o
  }

  function mix(a, b, t) {
    var d = a.d,
      e = b.d;
    for (var i = 0; i < d.length; i += 4) {
      d[i] += (e[i] - d[i]) * t;
      d[i + 1] += (e[i + 1] - d[i + 1]) * t;
      d[i + 2] += (e[i + 2] - d[i + 2]) * t
    }
    return a
  }

  function each(m, f) {
    var d = m.d,
      o = [0, 0, 0];
    for (var i = 0, n = d.length; i < n; i += 4) {
      f(d[i], d[i + 1], d[i + 2], o, i);
      d[i] = o[0];
      d[i + 1] = o[1];
      d[i + 2] = o[2]
    }
    return m
  }

  function curve(p) {
    var l = new Float32Array(256);
    for (var i = 0; i < 256; i++) {
      var k = 0;
      while (k < p.length - 2 && i > p[k + 1][0]) k++;
      var a = p[Math.max(0, k - 1)],
        b = p[k],
        c = p[k + 1],
        e = p[Math.min(p.length - 1, k + 2)],
        t = (i - b[0]) / ((c[0] - b[0]) || 1);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      var t2 = t * t,
        t3 = t2 * t;
      l[i] = C(.5 * (2 * b[1] + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - e[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + e[1]) * t3))
    }
    return l
  }

  // Tone curves: {rgb, r, g, b}, each a list of [in, out] points (0-255).
  // The RGB curve runs first, then the per-channel curves.
  function curveAdj(m, cv) {
    var M = cv.rgb ? curve(cv.rgb) : null,
      ch = [cv.r, cv.g, cv.b].map(function(p) {
        return p ? curve(p) : null
      }),
      T = ch.map(function(c) {
        var t = new Float32Array(256);
        for (var i = 0; i < 256; i++) {
          var x = M ? M[i] : i;
          t[i] = c ? c[Math.round(x)] : x
        }
        return t
      });
    return luts(m, T[0], T[1], T[2])
  }

  function luts(m, R, G, B) {
    G = G || R;
    B = B || R;
    var d = m.d;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = R[d[i]];
      d[i + 1] = G[d[i + 1]];
      d[i + 2] = B[d[i + 2]]
    }
    return m
  }

  function satm(m, k) {
    return each(m, function(r, g, b, o) {
      var y = L(r, g, b);
      o[0] = y + (r - y) * k;
      o[1] = y + (g - y) * k;
      o[2] = y + (b - y) * k
    })
  }

  function mul(m, a, b, c) {
    return each(m, function(r, g, bb, o) {
      o[0] = r * a;
      o[1] = g * b;
      o[2] = bb * c
    })
  }

  function tone(m, s, hh, a) {
    return each(m, function(r, g, b, o) {
      var l = L(r, g, b) / 255,
        ws = (1 - l) * (1 - l) * a,
        wh = l * l * a;
      o[0] = r + s[0] * ws + hh[0] * wh;
      o[1] = g + s[1] * ws + hh[1] * wh;
      o[2] = b + s[2] * ws + hh[2] * wh
    })
  }

  function gray(m, wt) {
    var a = wt || [.2126, .7152, .0722];
    return each(m, function(r, g, b, o) {
      o[0] = o[1] = o[2] = a[0] * r + a[1] * g + a[2] * b
    })
  }

  function gmap(m, st) {
    var T = [];
    for (var i = 0; i < 256; i++) {
      var t = i / 255,
        k = 0;
      while (k < st.length - 2 && t > st[k + 1][0]) k++;
      var a = st[k],
        b = st[k + 1],
        u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      T.push([a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u])
    }
    return each(m, function(r, g, b, o) {
      var c = T[L(r, g, b) | 0];
      o[0] = c[0];
      o[1] = c[1];
      o[2] = c[2]
    })
  }

  function post(m, n) {
    var s = 255 / (n - 1);
    return each(m, function(r, g, b, o) {
      o[0] = Math.round(r / s) * s;
      o[1] = Math.round(g / s) * s;
      o[2] = Math.round(b / s) * s
    })
  }

  function hueRot(m, deg) {
    var a = deg * Math.PI / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      M = [.213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928, .213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283, .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072];
    return each(m, function(r, g, b, o) {
      o[0] = M[0] * r + M[1] * g + M[2] * b;
      o[1] = M[3] * r + M[4] * g + M[5] * b;
      o[2] = M[6] * r + M[7] * g + M[8] * b
    })
  }

  function rgb2hsl(r, g, b, o) {
    r /= 255;
    g /= 255;
    b /= 255;
    var mx = Math.max(r, g, b),
      mn = Math.min(r, g, b),
      l = (mx + mn) / 2,
      h = 0,
      s = 0;
    if (mx !== mn) {
      var d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60
    }
    o[0] = h;
    o[1] = s;
    o[2] = l
  }

  function h2(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p
  }

  function hsl2rgb(h, s, l, o) {
    if (!s) {
      o[0] = o[1] = o[2] = l * 255;
      return
    }
    var q = l < .5 ? l * (1 + s) : l + s - l * s,
      p = 2 * l - q,
      hh = h / 360;
    o[0] = h2(p, q, hh + 1 / 3) * 255;
    o[1] = h2(p, q, hh) * 255;
    o[2] = h2(p, q, hh - 1 / 3) * 255
  }
  var BANDS = {
    red: 0,
    orange: 30,
    yellow: 58,
    green: 115,
    aqua: 180,
    blue: 222,
    purple: 275,
    magenta: 320
  };

  function hslAdj(m, H) {
    var bs = Object.keys(H).filter(function(k) {
      return BANDS[k] != null && H[k]
    });
    if (!bs.length) return m;
    var d = m.d,
      t = [0, 0, 0];
    for (var i = 0; i < d.length; i += 4) {
      rgb2hsl(d[i], d[i + 1], d[i + 2], t);
      var h = t[0],
        s = t[1],
        l = t[2];
      if (s < .03) continue;
      var dh = 0,
        ds = 0,
        dl = 0;
      for (var j = 0; j < bs.length; j++) {
        var x = Math.abs(h - BANDS[bs[j]]);
        if (x > 180) x = 360 - x;
        var w = 1 - x / 42;
        if (w <= 0) continue;
        var v = H[bs[j]];
        dh += (v.h || 0) * w;
        ds += (v.s || 0) * w;
        dl += (v.l || 0) * w
      }
      if (!dh && !ds && !dl) continue;
      var sw = Math.min(1, s * 3.5);
      h = (h + dh * .35 + 360) % 360;
      s = Math.max(0, Math.min(1, s * (1 + ds / 100 * sw)));
      l = Math.max(0, Math.min(1, l + dl / 100 * .3 * sw));
      hsl2rgb(h, s, l, t);
      d[i] = t[0];
      d[i + 1] = t[1];
      d[i + 2] = t[2]
    }
    return m
  }

  function sobel(l, w, h) {
    var o = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      var y0 = Math.max(0, y - 1) * w,
        y1 = y * w,
        y2 = Math.min(h - 1, y + 1) * w;
      for (var x = 0; x < w; x++) {
        var xa = Math.max(0, x - 1),
          xb = Math.min(w - 1, x + 1);
        var gx = l[y0 + xb] + 2 * l[y1 + xb] + l[y2 + xb] - l[y0 + xa] - 2 * l[y1 + xa] - l[y2 + xa],
          gy = l[y2 + xa] + 2 * l[y2 + x] + l[y2 + xb] - l[y0 + xa] - 2 * l[y0 + x] - l[y0 + xb];
        o[y1 + x] = Math.sqrt(gx * gx + gy * gy)
      }
    }
    return o
  }

  function kuwa(m, r) {
    var w = m.w,
      h = m.h,
      d = m.d,
      W = w + 1,
      N = W * (h + 1),
      SR = new Float64Array(N),
      SG = new Float64Array(N),
      SB = new Float64Array(N),
      SL = new Float64Array(N),
      S2 = new Float64Array(N);
    for (var y = 0; y < h; y++) {
      var ar = 0,
        ag = 0,
        ab = 0,
        al = 0,
        a2 = 0;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4,
          l = L(d[i], d[i + 1], d[i + 2]);
        ar += d[i];
        ag += d[i + 1];
        ab += d[i + 2];
        al += l;
        a2 += l * l;
        var j = (y + 1) * W + x + 1,
          u = y * W + x + 1;
        SR[j] = SR[u] + ar;
        SG[j] = SG[u] + ag;
        SB[j] = SB[u] + ab;
        SL[j] = SL[u] + al;
        S2[j] = S2[u] + a2
      }
    }
    var o = mk(w, h),
      od = o.d;

    function Q(A, x0, y0, x1, y1) {
      return A[y1 * W + x1] - A[y0 * W + x1] - A[y1 * W + x0] + A[y0 * W + x0]
    }
    for (y = 0; y < h; y++)
      for (x = 0; x < w; x++) {
        var best = 1e18,
          br = 0,
          bg = 0,
          bb = 0;
        for (var q = 0; q < 4; q++) {
          var x0 = q & 1 ? x : Math.max(0, x - r),
            x1 = q & 1 ? Math.min(w, x + r + 1) : x + 1,
            y0 = q & 2 ? y : Math.max(0, y - r),
            y1 = q & 2 ? Math.min(h, y + r + 1) : y + 1,
            n = (x1 - x0) * (y1 - y0),
            ml = Q(SL, x0, y0, x1, y1) / n,
            v = Q(S2, x0, y0, x1, y1) / n - ml * ml;
          if (v < best) {
            best = v;
            br = Q(SR, x0, y0, x1, y1) / n;
            bg = Q(SG, x0, y0, x1, y1) / n;
            bb = Q(SB, x0, y0, x1, y1) / n
          }
        }
        var k = (y * w + x) * 4;
        od[k] = br;
        od[k + 1] = bg;
        od[k + 2] = bb;
        od[k + 3] = 255
      }
    return o
  }

  /* ---- spatial ops ---- */
  function clarity(m, a) {
    var w = m.w,
      h = m.h,
      d = m.d,
      l = lum(m),
      b = blur1(l, w, h, Math.max(3, Math.round(Math.max(w, h) / 60)));
    for (var p = 0, i = 0; p < l.length; p++, i += 4) {
      var y = l[p],
        t = y / 127.5 - 1,
        df = (y - b[p]) * a * 1.3 * (1 - t * t * .7);
      d[i] += df;
      d[i + 1] += df;
      d[i + 2] += df
    }
    return m
  }

  function usm(m, a, r, thr) {
    var w = m.w,
      h = m.h,
      d = m.d,
      l = lum(m),
      b = blur1(l, w, h, r);
    for (var p = 0, i = 0; p < l.length; p++, i += 4) {
      var df = l[p] - b[p],
        ad = df < 0 ? -df : df;
      if (ad < thr * .5) continue;
      df *= a * ss(thr * .5, thr * 2.5, ad);
      if (df > 45) df = 45;
      else if (df < -45) df = -45;
      d[i] += df;
      d[i + 1] += df;
      d[i + 2] += df
    }
    return m
  }

  function glow(m, a) {
    var t = cp(m),
      d = t.d;
    for (var i = 0; i < d.length; i += 4) {
      var k = ss(130, 250, L(d[i], d[i + 1], d[i + 2]));
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k
    }
    var b = blurRGB(t, Math.max(2, Math.round(Math.max(m.w, m.h) / 40))),
      md = m.d,
      bd = b.d;
    for (i = 0; i < md.length; i += 4) {
      md[i] = 255 - (255 - md[i]) * (255 - bd[i] * a) / 255;
      md[i + 1] = 255 - (255 - md[i + 1]) * (255 - bd[i + 1] * a) / 255;
      md[i + 2] = 255 - (255 - md[i + 2]) * (255 - bd[i + 2] * a) / 255
    }
    return m
  }

  function vig(m, a) {
    var w = m.w,
      h = m.h,
      d = m.d,
      cx = w / 2,
      cy = h / 2,
      R = Math.sqrt(cx * cx + cy * cy);
    for (var y = 0; y < h; y++) {
      var dy = (y - cy) * (y - cy);
      for (var x = 0; x < w; x++) {
        var k = ss(.35, 1.05, Math.sqrt((x - cx) * (x - cx) + dy) / R) * a;
        if (!k) continue;
        var i = (y * w + x) * 4;
        if (k > 0) {
          var f = 1 - k * .85;
          d[i] *= f;
          d[i + 1] *= f;
          d[i + 2] *= f
        } else {
          k = -k * .7;
          d[i] += (255 - d[i]) * k;
          d[i + 1] += (255 - d[i + 1]) * k;
          d[i + 2] += (255 - d[i + 2]) * k
        }
      }
    }
    return m
  }

  function grain(m, a, seed) {
    var d = m.d;
    for (var p = 0, i = 0; i < d.length; p++, i += 4) {
      var l = L(d[i], d[i + 1], d[i + 2]) / 255,
        n = (hash(p * 2 + seed * 7919) + hash(p * 2 + 1 + seed * 104729) - 1) * a * 80 * (.35 + 2.4 * l * (1 - l));
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n
    }
    return m
  }

  function denoise(m, a) {
    var w = m.w,
      h = m.h,
      d = m.d,
      s = new Uint8ClampedArray(d),
      sr = 10 + a * 40,
      iv = 1 / (6 * sr * sr),
      DX = [],
      DY = [],
      WS = [],
      mx = Math.min(1, a * 1.6);
    for (var dy = -2; dy <= 2; dy++)
      for (var dx = -2; dx <= 2; dx++) {
        DX.push(dx);
        DY.push(dy);
        WS.push(Math.exp(-(dx * dx + dy * dy) / 4.5))
      }
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4,
          r0 = s[i],
          g0 = s[i + 1],
          b0 = s[i + 2],
          tr = 0,
          tg = 0,
          tb = 0,
          tw = 0;
        for (var k = 0; k < 25; k++) {
          var xx = x + DX[k],
            yy = y + DY[k];
          xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx;
          yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy;
          var j = (yy * w + xx) * 4,
            er = s[j] - r0,
            eg = s[j + 1] - g0,
            eb = s[j + 2] - b0,
            wv = WS[k] * Math.exp(-(er * er + eg * eg + eb * eb) * iv);
          tr += s[j] * wv;
          tg += s[j + 1] * wv;
          tb += s[j + 2] * wv;
          tw += wv
        }
        d[i] = r0 + (tr / tw - r0) * mx;
        d[i + 1] = g0 + (tg / tw - g0) * mx;
        d[i + 2] = b0 + (tb / tw - b0) * mx
      }
    return m
  }

  /* ---- adjustments ---- */
  function adjust(m, v) {
    if (!v) return m;
    var g = function(k) {
      return (v[k] || 0) / 100
    };
    var ex = g('exposure'),
      br = g('brightness'),
      co = g('contrast'),
      hi = g('highlights'),
      sh = g('shadows'),
      wa = g('warmth'),
      ti = g('tint'),
      sa = g('saturation'),
      vi = g('vibrance'),
      fa = g('fade');
    if (g('denoise') > 0) denoise(m, g('denoise'));
    if (ex || br || co || hi || sh || wa || ti || sa || vi || fa) {
      var T = new Float32Array(256),
        em = Math.pow(2, ex * 1.5),
        gm = br >= 0 ? 1 / (1 + br * .9) : 1 - br * 1.1;
      for (var i = 0; i < 256; i++) {
        var x = i / 255 * em;
        if (x > .8) x = .8 + .2 * (1 - Math.exp(-(x - .8) / .2));
        x = Math.pow(x, gm);
        if (co >= 0) {
          var sx = x * x * (3 - 2 * x);
          x = x + (sx - x) * co * 1.3 + (x - .5) * co * .35
        } else x = .5 + (x - .5) * (1 + co * .75);
        if (fa) x = x * (1 - fa * .25) + fa * .2;
        T[i] = x * 255
      }
      var wr = 1 + wa * .13 + ti * .05,
        wg = 1 + wa * .02 - ti * .1,
        wb = 1 - wa * .17 + ti * .05,
        hs = hi || sh,
        d = m.d;
      for (i = 0; i < d.length; i += 4) {
        var r = T[d[i]] * wr,
          gg = T[d[i + 1]] * wg,
          b = T[d[i + 2]] * wb;
        if (hs) {
          var l = L(r, gg, b) / 255,
            dl = (hi * .32 * ss(.45, 1, l) + sh * .36 * (1 - ss(0, .6, l))) * 255;
          r += dl;
          gg += dl;
          b += dl
        }
        if (sa || vi) {
          var y = L(r, gg, b),
            k = 1 + sa;
          if (vi) {
            var mx = Math.max(r, gg, b),
              mn = Math.min(r, gg, b);
            k += vi * (1 - Math.min(1, (mx - mn) / (mx + 1))) * 1.2
          }
          r = y + (r - y) * k;
          gg = y + (gg - y) * k;
          b = y + (b - y) * k
        }
        d[i] = r;
        d[i + 1] = gg;
        d[i + 2] = b
      }
    }
    if (v.curve) curveAdj(m, v.curve);
    if (v.hsl) hslAdj(m, v.hsl);
    var cl = g('clarity');
    if (cl) clarity(m, cl);
    var gl = g('glow');
    if (gl > 0) glow(m, gl);
    var sp = g('sharpen');
    if (sp > 0) usm(m, sp * 1.4, 1, 3.5);
    else if (sp < 0) mix(m, blurRGB(m, Math.max(1, Math.round(Math.max(m.w, m.h) / 350))), -sp);
    var vg = g('vignette');
    if (vg) vig(m, vg);
    var gr = g('grain');
    if (gr > 0) grain(m, gr, 7);
    return m
  }

  /* ---- auto enhance ---- */
  function analyze(m) {
    var d = m.d,
      n = m.w * m.h,
      st = Math.max(1, Math.floor(n / 150000)),
      H = [new Float64Array(256), new Float64Array(256), new Float64Array(256)],
      c = 0,
      ssat = 0,
      sl = 0,
      sl2 = 0;
    for (var p = 0; p < n; p += st) {
      var i = p * 4,
        r = d[i],
        g = d[i + 1],
        b = d[i + 2];
      H[0][r]++;
      H[1][g]++;
      H[2][b]++;
      var mx = Math.max(r, g, b),
        mn = Math.min(r, g, b);
      ssat += mx ? (mx - mn) / mx : 0;
      var l = L(r, g, b);
      sl += l;
      sl2 += l * l;
      c++
    }

    function pct(h, q) {
      var a = 0,
        t = c * q;
      for (var i = 0; i < 256; i++) {
        a += h[i];
        if (a >= t) return i
      }
      return 255
    }
    var lo = H.map(function(h) {
        return pct(h, .005)
      }),
      hi = H.map(function(h) {
        return pct(h, .995)
      }),
      loS = Math.min.apply(0, lo),
      hiS = Math.max.apply(0, hi);
    for (var k = 0; k < 3; k++) {
      lo[k] = lo[k] * .65 + loS * .35;
      hi[k] = hi[k] * .65 + hiS * .35;
      if (hi[k] - lo[k] < 40) hi[k] = lo[k] + 40
    }
    var mean = H.map(function(h, k) {
      var s = 0;
      for (var i = 0; i < 256; i++) s += h[i] * Math.max(0, Math.min(1, (i - lo[k]) / (hi[k] - lo[k])));
      return s / c
    });
    var avg = (mean[0] + mean[1] + mean[2]) / 3,
      wb = mean.map(function(v) {
        return Math.pow(Math.max(.86, Math.min(1.16, avg / (v || 1e-3))), .7)
      });
    var ml = Math.max(.05, .2126 * mean[0] * wb[0] + .7152 * mean[1] * wb[1] + .0722 * mean[2] * wb[2]),
      gam = Math.max(.72, Math.min(1.3, Math.log(.46) / Math.log(ml)));
    var msat = ssat / c,
      std = Math.sqrt(Math.max(0, sl2 / c - (sl / c) * (sl / c)));
    var vib = Math.round(Math.max(8, Math.min(40, (.42 - msat) * 120))),
      clar = Math.round(Math.max(12, Math.min(38, (70 - std) * .6))),
      sharp = 30;
    var cast = wb[2] < .97 ? 'removed a blue cast' : wb[0] < .97 ? 'removed a warm/red cast' : wb[1] < .97 ? 'removed a green cast' : 'colors already balanced';
    var notes = ['Levels stretched ' + Math.round((lo[0] + lo[1] + lo[2]) / 3) + '–' + Math.round((hi[0] + hi[1] + hi[2]) / 3) + ' → full range', 'White balance: ' + cast, 'Exposure: ' + (gam < .97 ? 'brightened midtones' : gam > 1.03 ? 'darkened midtones' : 'kept'), 'Clarity +' + clar + ' · Vibrance +' + vib + ' · Sharpen +' + sharp];
    return {
      lo: lo,
      hi: hi,
      wb: wb,
      gam: gam,
      vib: vib,
      clar: clar,
      sharp: sharp,
      notes: notes,
      amt: .85
    }
  }

  function enhance(m, e) {
    var a = e.amt,
      T = [0, 1, 2].map(function(k) {
        var t = new Float32Array(256);
        for (var i = 0; i < 256; i++) {
          var x = (i - e.lo[k]) / (e.hi[k] - e.lo[k]);
          x = Math.max(0, Math.min(1, x)) * e.wb[k];
          x = Math.pow(Math.min(1, x), e.gam) * 255;
          t[i] = i + (x - i) * a
        }
        return t
      });
    luts(m, T[0], T[1], T[2]);
    return adjust(m, {
      vibrance: e.vib * a,
      clarity: e.clar * a,
      sharpen: e.sharp * a
    })
  }

  /* ---- skin protection ---- */
  function skinKeep(m, base, amt) {
    var d = m.d,
      o = base.d;
    for (var i = 0; i < d.length; i += 4) {
      var r = o[i],
        g = o[i + 1],
        b = o[i + 2],
        cb = 128 - .1687 * r - .3313 * g + .5 * b,
        cr = 128 + .5 * r - .4187 * g - .0813 * b;
      var w = ss(132, 140, cr) * (1 - ss(172, 184, cr)) * ss(78, 90, cb) * (1 - ss(126, 138, cb)) * amt;
      if (w < .01) continue;
      var yo = L(r, g, b),
        yr = L(d[i], d[i + 1], d[i + 2]);
      d[i] += (yr + r - yo - d[i]) * w;
      d[i + 1] += (yr + g - yo - d[i + 1]) * w;
      d[i + 2] += (yr + b - yo - d[i + 2]) * w
    }
    return m
  }

  /* ---- filter helpers ---- */
  function halation(m) {
    var t = cp(m);
    each(t, function(r, g, b, o) {
      var k = ss(185, 255, L(r, g, b));
      o[0] = 255 * k;
      o[1] = 70 * k;
      o[2] = 30 * k
    });
    var b = blurRGB(t, Math.max(3, Math.round(Math.max(m.w, m.h) / 60))),
      md = m.d,
      bd = b.d;
    for (var i = 0; i < md.length; i += 4) {
      md[i] = 255 - (255 - md[i]) * (255 - bd[i] * .9) / 255;
      md[i + 1] = 255 - (255 - md[i + 1]) * (255 - bd[i + 1] * .9) / 255;
      md[i + 2] = 255 - (255 - md[i + 2]) * (255 - bd[i + 2] * .9) / 255
    }
    return m
  }

  function light(m, fx, fy, rad, col, a) {
    var w = m.w,
      h = m.h,
      d = m.d,
      cx = fx * w,
      cy = fy * h,
      R = Math.max(w, h) * rad;
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var t = 1 - Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / R;
        if (t <= 0) continue;
        t = t * t * a;
        var i = (y * w + x) * 4;
        d[i] = 255 - (255 - d[i]) * (1 - col[0] / 255 * t);
        d[i + 1] = 255 - (255 - d[i + 1]) * (1 - col[1] / 255 * t);
        d[i + 2] = 255 - (255 - d[i + 2]) * (1 - col[2] / 255 * t)
      }
    return m
  }

  function tealOrange(m, a) {
    each(m, function(r, g, b, o) {
      var y = L(r, g, b) / 255,
        s = (1 - y) * a,
        wk = (Math.max(0, (r - b) / 255) * 1.3 + y * .35) * a;
      o[0] = r - 24 * s + 26 * wk;
      o[1] = g + 8 * s + 6 * wk;
      o[2] = b + 22 * s - 28 * wk
    });
    return satm(m, 1.1)
  }

  function frame(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      b = Math.round(Math.min(w, h) * .045),
      bb = Math.round(b * 3.2);
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        if (x >= b && x < w - b && y >= b && y < h - bb) continue;
        var i = (y * w + x) * 4;
        d[i] = 246;
        d[i + 1] = 244;
        d[i + 2] = 238
      }
    return m
  }

  function bars(m) {
    var w = m.w,
      h = m.h,
      bh = Math.round((h - w / 2.39) / 2);
    if (bh <= 0) return m;
    var d = m.d;
    for (var y = 0; y < h; y++) {
      if (y >= bh && y < h - bh) continue;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        d[i] = d[i + 1] = d[i + 2] = 4
      }
    }
    return m
  }

  function halftone(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      c = Math.max(4, Math.round(Math.min(w, h) / 80)),
      o = mk(w, h),
      od = o.d;
    for (var cy = 0; cy < h; cy += c)
      for (var cx = 0; cx < w; cx += c) {
        var r = 0,
          g = 0,
          b = 0,
          n = 0,
          ye = Math.min(h, cy + c),
          xe = Math.min(w, cx + c),
          y, x, i;
        for (y = cy; y < ye; y++)
          for (x = cx; x < xe; x++) {
            i = (y * w + x) * 4;
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            n++
          }
        r /= n;
        g /= n;
        b /= n;
        var rad = c * .72 * Math.sqrt(1 - L(r, g, b) / 255),
          mx = cx + c / 2,
          my = cy + c / 2,
          y2 = L(r, g, b),
          dr = (y2 + (r - y2) * 1.5) * .8,
          dg = (y2 + (g - y2) * 1.5) * .8,
          db = (y2 + (b - y2) * 1.5) * .8;
        for (y = cy; y < ye; y++)
          for (x = cx; x < xe; x++) {
            var t = 1 - ss(rad - .8, rad + .8, Math.sqrt((x + .5 - mx) * (x + .5 - mx) + (y + .5 - my) * (y + .5 - my)));
            i = (y * w + x) * 4;
            od[i] = 245 + (dr - 245) * t;
            od[i + 1] = 240 + (dg - 240) * t;
            od[i + 2] = 228 + (db - 228) * t;
            od[i + 3] = 255
          }
      }
    return o
  }

  function pixel(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      c = Math.max(3, Math.round(Math.min(w, h) / 56));
    for (var cy = 0; cy < h; cy += c)
      for (var cx = 0; cx < w; cx += c) {
        var r = 0,
          g = 0,
          b = 0,
          n = 0,
          ye = Math.min(h, cy + c),
          xe = Math.min(w, cx + c),
          y, x, i;
        for (y = cy; y < ye; y++)
          for (x = cx; x < xe; x++) {
            i = (y * w + x) * 4;
            r += d[i];
            g += d[i + 1];
            b += d[i + 2];
            n++
          }
        var s = 255 / 7;
        r = Math.round(r / n / s) * s;
        g = Math.round(g / n / s) * s;
        b = Math.round(b / n / s) * s;
        for (y = cy; y < ye; y++)
          for (x = cx; x < xe; x++) {
            i = (y * w + x) * 4;
            d[i] = r;
            d[i + 1] = g;
            d[i + 2] = b
          }
      }
    return m
  }

  function sketch(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      l = lum(m),
      inv = l.map(function(v) {
        return 255 - v
      }),
      b = blur1(inv, w, h, Math.max(2, Math.round(Math.max(w, h) / 150)));
    for (var p = 0, i = 0; p < l.length; p++, i += 4) {
      var v = b[p] >= 254.5 ? 255 : Math.min(255, l[p] * 255 / (255 - b[p]));
      v = 255 - (255 - v) * 1.35;
      d[i] = v;
      d[i + 1] = v * .99;
      d[i + 2] = v * .95
    }
    return m
  }

  function emboss(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      l = lum(m);
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var a = l[Math.max(0, y - 1) * w + Math.max(0, x - 1)],
          b = l[Math.min(h - 1, y + 1) * w + Math.min(w - 1, x + 1)],
          v = 128 + (b - a) * 2.2,
          i = (y * w + x) * 4;
        d[i] = v * .85 + d[i] * .15;
        d[i + 1] = v * .85 + d[i + 1] * .15;
        d[i + 2] = v * .85 + d[i + 2] * .15
      }
    return m
  }

  function edges(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      e = sobel(blur1(lum(m), w, h, 1), w, h);
    for (var p = 0, i = 0; p < e.length; p++, i += 4) {
      var k = ss(12, 80, e[p]) * 1.5,
        y = L(d[i], d[i + 1], d[i + 2]);
      d[i] = (y + (d[i] - y) * 2.2) * k + 20 * k;
      d[i + 1] = (y + (d[i + 1] - y) * 2.2) * k + 20 * k;
      d[i + 2] = (y + (d[i + 2] - y) * 2.2) * k + 30 * k
    }
    return glow(m, .7)
  }

  function glitch(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      o = mk(w, h),
      od = o.d,
      sh = Math.max(2, Math.round(w / 110)),
      bh = Math.max(2, Math.round(h / 36)),
      off = 0;
    for (var y = 0; y < h; y++) {
      if (y % bh === 0) {
        var band = y / bh | 0;
        off = hash(band * 7 + 11) > .7 ? Math.round((hash(band * 13 + 5) - .5) * w * .12) : 0
      }
      var dark = y % 3 === 0 ? .8 : 1;
      for (var x = 0; x < w; x++) {
        var xr = Math.min(w - 1, Math.max(0, x + off + sh)),
          xg = Math.min(w - 1, Math.max(0, x + off)),
          xb = Math.min(w - 1, Math.max(0, x + off - sh)),
          i = (y * w + x) * 4,
          r = y * w;
        od[i] = d[(r + xr) * 4] * dark;
        od[i + 1] = d[(r + xg) * 4 + 1] * dark;
        od[i + 2] = d[(r + xb) * 4 + 2] * dark;
        od[i + 3] = 255
      }
    }
    return o
  }

  function cartoon(m) {
    var w = m.w,
      h = m.h,
      k = kuwa(m, Math.max(2, Math.round(Math.max(w, h) / 280)));
    post(k, 6);
    satm(k, 1.25);
    var e = sobel(blur1(lum(m), w, h, 1), w, h),
      d = k.d;
    for (var p = 0, i = 0; p < e.length; p++, i += 4) {
      var a = 1 - ss(45, 120, e[p]) * .9;
      d[i] *= a;
      d[i + 1] *= a;
      d[i + 2] *= a
    }
    return k
  }

  function tilt(m) {
    var w = m.w,
      h = m.h,
      b = blurRGB(m, Math.max(2, Math.round(Math.max(w, h) / 70))),
      d = m.d,
      bd = b.d;
    for (var y = 0; y < h; y++) {
      var t = ss(.1, .36, Math.abs(y / h - .56));
      if (!t) continue;
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        d[i] += (bd[i] - d[i]) * t;
        d[i + 1] += (bd[i + 1] - d[i + 1]) * t;
        d[i + 2] += (bd[i + 2] - d[i + 2]) * t
      }
    }
    satm(m, 1.4);
    return luts(m, curve([
      [0, 0],
      [64, 54],
      [192, 206],
      [255, 255]
    ]))
  }

  function chroma(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      o = mk(w, h),
      od = o.d,
      cx = w / 2,
      cy = h / 2,
      k = .014;
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var dx = x - cx,
          dy = y - cy,
          xr = Math.min(w - 1, Math.max(0, Math.round(cx + dx * (1 - k)))),
          yr = Math.min(h - 1, Math.max(0, Math.round(cy + dy * (1 - k)))),
          xb = Math.min(w - 1, Math.max(0, Math.round(cx + dx * (1 + k)))),
          yb = Math.min(h - 1, Math.max(0, Math.round(cy + dy * (1 + k)))),
          i = (y * w + x) * 4;
        od[i] = d[(yr * w + xr) * 4];
        od[i + 1] = d[i + 1];
        od[i + 2] = d[(yb * w + xb) * 4 + 2];
        od[i + 3] = 255
      }
    return vig(o, .35)
  }

  function splash(m) {
    var t = [0, 0, 0];
    return each(m, function(r, g, b, o) {
      rgb2hsl(r, g, b, t);
      var x = Math.min(t[0], 360 - t[0]),
        k = (1 - ss(16, 36, x)) * ss(.15, .32, t[1]) * 1.2,
        y = L(r, g, b);
      o[0] = y + (r - y) * k;
      o[1] = y + (g - y) * k;
      o[2] = y + (b - y) * k
    })
  }

  // Orange seven-segment date stamp in the bottom-right corner, like a 90s point-and-shoot.
  function stamp(m, txt) {
    var w = m.w,
      h = m.h,
      d = m.d,
      H = Math.max(7, Math.round(Math.min(w, h) * .045)),
      W = Math.round(H * .55),
      t = Math.max(1, Math.round(H * .13)),
      hh = Math.round(H / 2),
      gap = Math.max(1, Math.round(W * .45)),
      SEG = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'],
      a = new Float32Array(w * h),
      tw = 0,
      i;
    for (i = 0; i < txt.length; i++) tw += txt[i] === ' ' ? Math.round(W * .6) : txt[i] === "'" ? t + gap : W + gap;
    var cx = w - Math.round(w * .05) - tw,
      y0 = h - Math.round(h * .06) - H;
    if (cx < 0 || y0 < 0) return m;

    function rect(x1, y1, x2, y2) {
      for (var y = y1; y < y2; y++) {
        var sl = Math.round((y0 + H - y) * .12);
        for (var x = x1; x < x2; x++) {
          var xx = x + sl;
          if (xx >= 0 && xx < w && y >= 0 && y < h) a[y * w + xx] = 1
        }
      }
    }
    for (i = 0; i < txt.length; i++) {
      var ch = txt[i];
      if (ch === ' ') {
        cx += Math.round(W * .6);
        continue
      }
      if (ch === "'") {
        rect(cx, y0, cx + t, y0 + Math.round(H * .3));
        cx += t + gap;
        continue
      }
      var sg = SEG[+ch] || '';
      if (sg.indexOf('a') >= 0) rect(cx + t, y0, cx + W - t, y0 + t);
      if (sg.indexOf('b') >= 0) rect(cx + W - t, y0 + t, cx + W, y0 + hh);
      if (sg.indexOf('c') >= 0) rect(cx + W - t, y0 + hh, cx + W, y0 + H - t);
      if (sg.indexOf('d') >= 0) rect(cx + t, y0 + H - t, cx + W - t, y0 + H);
      if (sg.indexOf('e') >= 0) rect(cx, y0 + hh, cx + t, y0 + H - t);
      if (sg.indexOf('f') >= 0) rect(cx, y0 + t, cx + t, y0 + hh);
      if (sg.indexOf('g') >= 0) rect(cx + t, y0 + hh - (t >> 1), cx + W - t, y0 + hh - (t >> 1) + t);
      cx += W + gap
    }
    var g = blur1(a, w, h, Math.max(1, t * 1.5)),
      col = [255, 150, 50];
    for (var p = 0, j = 0; p < a.length; p++, j += 4) {
      var k = Math.min(1, a[p] * .9 + g[p] * .8);
      if (k < .01) continue;
      d[j] = 255 - (255 - d[j]) * (1 - col[0] / 255 * k);
      d[j + 1] = 255 - (255 - d[j + 1]) * (1 - col[1] / 255 * k);
      d[j + 2] = 255 - (255 - d[j + 2]) * (1 - col[2] / 255 * k)
    }
    return m
  }

  // Colour infrared film: foliage turns red-magenta, skies go deep.
  function aerochrome(m) {
    var d = m.d,
      t = [0, 0, 0];
    for (var i = 0; i < d.length; i += 4) {
      rgb2hsl(d[i], d[i + 1], d[i + 2], t);
      var h = t[0],
        s = t[1],
        l = t[2],
        dg = Math.abs(h - 105),
        db = Math.abs(h - 220),
        wg = (1 - ss(35, 70, dg)) * ss(.08, .25, s),
        wb = (1 - ss(20, 50, db)) * ss(.08, .25, s);
      if (!wg && !wb) continue;
      h = (h - 140 * wg + 360) % 360;
      s = Math.min(1, s * (1 + .5 * wg + .3 * wb));
      l = Math.max(0, l - .06 * wb);
      hsl2rgb(h, s, l, t);
      d[i] = t[0];
      d[i + 1] = t[1];
      d[i + 2] = t[2]
    }
    luts(m, curve([
      [0, 0],
      [64, 52],
      [192, 208],
      [255, 255]
    ]));
    return satm(m, 1.1)
  }

  // Tape: smeared chroma that lags the luma, scanlines, noise and a tracking band.
  function vhs(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      n = w * h,
      Y = new Float32Array(n),
      U = new Float32Array(n),
      V = new Float32Array(n),
      T = new Float32Array(n);
    for (var p = 0, i = 0; p < n; p++, i += 4) {
      var r = d[i],
        g = d[i + 1],
        b = d[i + 2];
      Y[p] = .299 * r + .587 * g + .114 * b;
      U[p] = -.1687 * r - .3313 * g + .5 * b;
      V[p] = .5 * r - .4187 * g - .0813 * b
    }
    var cr = Math.max(2, Math.round(w / 90));
    boxH(U, T, w, h, cr);
    boxH(T, U, w, h, cr);
    boxH(V, T, w, h, cr);
    boxH(T, V, w, h, cr);
    boxH(Y, T, w, h, 1);
    var o = mk(w, h),
      od = o.d,
      sh = Math.max(1, Math.round(w / 200)),
      b0 = Math.round(h * .88),
      b1 = Math.round(h * .92);
    for (var y = 0; y < h; y++) {
      var trk = y >= b0 && y < b1,
        off = trk ? Math.round((hash(y * 31 + 7) - .3) * w * .03) : 0,
        line = y % 2 ? .92 : 1;
      for (var x = 0; x < w; x++) {
        var sx = Math.min(w - 1, Math.max(0, x - off)),
          cx = Math.min(w - 1, Math.max(0, sx - sh)),
          q = y * w + sx,
          c = y * w + cx,
          nz = (hash(y * w + x + 999) - .5) * (trk ? 70 : 16),
          yy = T[q] * .7 + Y[q] * .3 + nz,
          k = (y * w + x) * 4;
        od[k] = (yy + 1.402 * V[c]) * line;
        od[k + 1] = (yy - .344 * U[c] - .714 * V[c]) * line;
        od[k + 2] = (yy + 1.772 * U[c]) * line;
        od[k + 3] = 255
      }
    }
    satm(o, .85);
    return luts(o, curve([
      [0, 18],
      [128, 132],
      [255, 238]
    ]))
  }

  // Early colour plates: pastel colour and speckles of dyed starch grains.
  function autochrome(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      s = Math.max(1, Math.round(Math.min(w, h) / 300)),
      G = [
        [1, .45, -.6],
        [-.5, .8, -.3],
        [.2, -.6, 1]
      ];
    satm(m, .78);
    luts(m, curve([
      [0, 26],
      [128, 136],
      [255, 238]
    ]), curve([
      [0, 22],
      [128, 128],
      [255, 232]
    ]), curve([
      [0, 20],
      [128, 116],
      [255, 212]
    ]));
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var cell = ((y / s) | 0) * 9973 + ((x / s) | 0),
          hv = hash(cell),
          col = G[hv < .33 ? 0 : hv < .66 ? 1 : 2],
          a = 16 * (hash(cell + 7) * .8 + .2),
          i = (y * w + x) * 4;
        d[i] += col[0] * a;
        d[i + 1] += col[1] * a;
        d[i + 2] += col[2] * a
      }
    mix(m, blurRGB(m, Math.max(1, Math.round(Math.max(w, h) / 500))), .35);
    return vig(m, .5)
  }

  function daguerreotype(m) {
    var w = m.w,
      h = m.h;
    gray(m);
    mix(m, blurRGB(m, Math.max(1, Math.round(Math.max(w, h) / 300))), .5);
    luts(m, curve([
      [0, 20],
      [128, 120],
      [255, 236]
    ]));
    gmap(m, [
      [0, [14, 16, 20]],
      [.5, [120, 126, 130]],
      [1, [226, 230, 228]]
    ]);
    vig(m, .9);
    var d = m.d,
      s = Math.max(1, Math.round(Math.min(w, h) / 400));
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var hv = hash(((y / s) | 0) * 7919 + ((x / s) | 0) + 31),
          i = (y * w + x) * 4,
          k = hv > .9985 ? -90 : hv < .0008 ? 80 : 0;
        if (!k) continue;
        d[i] += k;
        d[i + 1] += k;
        d[i + 2] += k
      }
    return m
  }

  // Soft Kuwahara wash, pigment pooling at edges, paper texture.
  function watercolor(m) {
    var w = m.w,
      h = m.h,
      n = w * h,
      k = kuwa(m, Math.max(2, Math.round(Math.max(w, h) / 180))),
      e = sobel(blur1(lum(k), w, h, 1), w, h),
      pn = new Float32Array(n);
    for (var p = 0; p < n; p++) pn[p] = hash(p * 3 + 17);
    pn = blur1(pn, w, h, Math.max(1, Math.round(Math.max(w, h) / 300)));
    var d = k.d;
    for (p = 0; p < n; p++) {
      var i = p * 4,
        ed = 1 - ss(10, 60, e[p]) * .3,
        tx = (pn[p] - .5) * 55;
      for (var c = 0; c < 3; c++) d[i + c] = (255 - (255 - d[i + c]) * .82) * ed + tx
    }
    return satm(k, 1.12)
  }

  // Ink hatching: more line directions the darker the tone.
  function hatch(m) {
    var w = m.w,
      h = m.h,
      l = blur1(lum(m), w, h, 1),
      s = Math.max(5, Math.round(Math.min(w, h) / 70)),
      tt = Math.max(.35, s * .07),
      o = mk(w, h),
      od = o.d,
      INK = [30, 34, 52],
      PAP = [247, 243, 234];

    function ln(u) {
      var r = ((u % s) + s) % s;
      return 1 - ss(tt, tt + .9, Math.abs(r - s / 2))
    }
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var p = y * w + x,
          v = l[p],
          a = 0;
        if (v < 215) a = Math.max(a, ln(x + y) * ss(215, 175, v));
        if (v < 160) a = Math.max(a, ln(x - y + h * s) * ss(160, 125, v));
        if (v < 105) a = Math.max(a, ln(x + y + s / 2) * ss(105, 75, v));
        if (v < 55) a = Math.max(a, ln(y) * ss(55, 30, v));
        var i = p * 4;
        for (var c = 0; c < 3; c++) od[i + c] = PAP[c] + (INK[c] - PAP[c]) * a;
        od[i + 3] = 255
      }
    return o
  }

  // Two-ink print (fluoro pink + blue) with misregistration and grainy ink.
  function riso(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      o = mk(w, h),
      od = o.d,
      A = [255, 72, 160],
      B = [0, 112, 186],
      PAP = [244, 240, 228],
      off = Math.max(1, Math.round(w / 160));
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var p = y * w + x,
          i = p * 4,
          j = (Math.max(0, y - off) * w + Math.max(0, x - off)) * 4,
          da = Math.min(1, Math.max(0, 1 - (d[i + 1] * .7 + d[i + 2] * .3) / 255) * 1.1 * (.75 + .5 * hash(p * 2 + 3))),
          db = Math.min(1, Math.max(0, 1 - (d[j] * .8 + d[j + 1] * .2) / 255) * 1.05 * (.75 + .5 * hash(p * 2 + 9)));
        for (var c = 0; c < 3; c++) od[i + c] = PAP[c] * (1 - da * (1 - A[c] / 255)) * (1 - db * (1 - B[c] / 255));
        od[i + 3] = 255
      }
    return o
  }

  function zoomBurst(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      o = mk(w, h),
      od = o.d,
      cx = w / 2,
      cy = h / 2,
      R = Math.sqrt(cx * cx + cy * cy),
      N = 12;
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var dx = x - cx,
          dy = y - cy,
          amt = ss(.12, .9, Math.sqrt(dx * dx + dy * dy) / R) * .14,
          k = (y * w + x) * 4;
        if (amt <= 0) {
          od[k] = d[k];
          od[k + 1] = d[k + 1];
          od[k + 2] = d[k + 2];
          od[k + 3] = 255;
          continue
        }
        var r = 0,
          g = 0,
          b = 0;
        for (var s = 0; s < N; s++) {
          var f = 1 - amt * s / (N - 1),
            j = (Math.round(cy + dy * f) * w + Math.round(cx + dx * f)) * 4;
          r += d[j];
          g += d[j + 1];
          b += d[j + 2]
        }
        od[k] = r / N;
        od[k + 1] = g / N;
        od[k + 2] = b / N;
        od[k + 3] = 255
      }
    return o
  }

  // Six mirrored wedges around the centre.
  function kaleido(m) {
    var w = m.w,
      h = m.h,
      d = m.d,
      o = mk(w, h),
      od = o.d,
      cx = w / 2,
      cy = h / 2,
      sg = Math.PI / 3,
      base = -Math.PI / 2 - sg / 2;
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var dx = x - cx,
          dy = y - cy,
          r = Math.sqrt(dx * dx + dy * dy) * .9,
          a = ((Math.atan2(dy, dx) % (2 * sg)) + 2 * sg) % (2 * sg);
        if (a > sg) a = 2 * sg - a;
        var sx = Math.round(cx + r * Math.cos(a + base)),
          sy = Math.round(cy + r * Math.sin(a + base));
        sx = sx < 0 ? -sx : sx >= w ? 2 * w - sx - 2 : sx;
        sy = sy < 0 ? -sy : sy >= h ? 2 * h - sy - 2 : sy;
        sx = Math.max(0, Math.min(w - 1, sx));
        sy = Math.max(0, Math.min(h - 1, sy));
        var j = (sy * w + sx) * 4,
          k = (y * w + x) * 4;
        od[k] = d[j];
        od[k + 1] = d[j + 1];
        od[k + 2] = d[j + 2];
        od[k + 3] = 255
      }
    return o
  }

  // Orton effect: a sharp brightened copy multiplied by a blurred one.
  function orton(m) {
    var s = each(cp(m), function(r, g, b, o) {
        o[0] = 255 - (255 - r) * (255 - r) / 255;
        o[1] = 255 - (255 - g) * (255 - g) / 255;
        o[2] = 255 - (255 - b) * (255 - b) / 255
      }),
      bl = blurRGB(s, Math.max(2, Math.round(Math.max(m.w, m.h) / 50))),
      md = m.d,
      sd = s.d,
      bd = bl.d;
    for (var i = 0; i < md.length; i += 4)
      for (var c = 0; c < 3; c++) md[i + c] += (sd[i + c] * bd[i + c] / 255 - md[i + c]) * .75;
    return satm(m, 1.1)
  }

  // Blend a filter in only where it was placed: corners, sides, centre or edges, with soft falloff.
  function posMix(out, pre, s, at) {
    var w = out.w,
      h = out.h,
      d = out.d,
      p = pre.d,
      mn = Math.min(w, h),
      C = {
        tl: [0, 0],
        tr: [1, 0],
        bl: [0, 1],
        br: [1, 1]
      };
    for (var y = 0; y < h; y++) {
      var v = (y + .5) / h;
      for (var x = 0; x < w; x++) {
        var u = (x + .5) / w,
          a = 0;
        for (var j = 0; j < at.length; j++) {
          var k = at[j],
            c = C[k],
            q = c ? 1 - ss(.3, .75, Math.hypot((u - c[0]) * w, (v - c[1]) * h) / mn) : k === 't' ? 1 - ss(.35, .6, v) : k === 'b' ? ss(.4, .65, v) : k === 'l' ? 1 - ss(.35, .6, u) : k === 'r' ? ss(.4, .65, u) : k === 'c' ? 1 - ss(.2, .55, Math.hypot((u - .5) * w, (v - .5) * h) / mn) : k === 'edges' ? ss(.55, .95, Math.max(Math.abs(2 * u - 1), Math.abs(2 * v - 1))) : 0;
          if (q > a) a = q
        }
        var t = a * s,
          i = (y * w + x) * 4;
        if (t >= 1) continue;
        d[i] = p[i] + (d[i] - p[i]) * t;
        d[i + 1] = p[i + 1] + (d[i + 1] - p[i + 1]) * t;
        d[i + 2] = p[i + 2] + (d[i + 2] - p[i + 2]) * t
      }
    }
    return out
  }

  var FL = [
    ['portra', 'Portra 400', 'Film', function(m) {
      luts(m, curve([
        [0, 20],
        [70, 78],
        [140, 146],
        [210, 212],
        [255, 246]
      ]), curve([
        [0, 16],
        [128, 130],
        [255, 242]
      ]), curve([
        [0, 24],
        [128, 122],
        [255, 226]
      ]));
      satm(m, .86);
      return tone(m, [-4, 4, 10], [14, 6, -10], 1)
    }],
    ['ektar', 'Ektar 100', 'Film', function(m) {
      var c = curve([
        [0, 0],
        [50, 36],
        [128, 132],
        [205, 222],
        [255, 255]
      ]);
      luts(m, c, c, curve([
        [0, 6],
        [128, 126],
        [255, 248]
      ]));
      return satm(m, 1.45)
    }],
    ['velvia', 'Velvia 50', 'Film', function(m) {
      var c = curve([
        [0, 0],
        [64, 48],
        [128, 128],
        [192, 210],
        [255, 255]
      ]);
      luts(m, c);
      hslAdj(m, {
        green: {
          s: 60
        },
        blue: {
          s: 50
        },
        aqua: {
          s: 50
        },
        red: {
          s: 30
        }
      });
      satm(m, 1.2);
      return tone(m, [12, -6, 12], [0, 0, 0], 1)
    }],
    ['cinestill', 'CineStill 800T', 'Film', function(m) {
      mul(m, .88, .98, 1.16);
      luts(m, curve([
        [0, 12],
        [128, 122],
        [255, 250]
      ]));
      return halation(m)
    }],
    ['kodachrome', 'Kodachrome', 'Film', function(m) {
      luts(m, curve([
        [0, 8],
        [64, 62],
        [128, 140],
        [192, 206],
        [255, 250]
      ]), curve([
        [0, 4],
        [128, 126],
        [255, 240]
      ]), curve([
        [0, 10],
        [128, 112],
        [255, 222]
      ]));
      hslAdj(m, {
        red: {
          s: 35
        },
        blue: {
          s: 25,
          l: -15
        }
      });
      return satm(m, 1.15)
    }],
    ['expired', 'Expired Film', 'Film', function(m) {
      luts(m, curve([
        [0, 40],
        [128, 150],
        [255, 238]
      ]), curve([
        [0, 22],
        [128, 116],
        [255, 228]
      ]), curve([
        [0, 48],
        [128, 126],
        [255, 196]
      ]));
      satm(m, .72);
      light(m, -.05, .35, .6, [255, 110, 40], .9);
      return grain(m, .35, 3)
    }],
    ['gold200', 'Gold 200', 'Film', function(m) {
      luts(m, curve([[0, 14], [128, 142], [255, 250]]), curve([[0, 10], [128, 134], [255, 240]]), curve([[0, 6], [128, 112], [255, 210]]));
      satm(m, 1.12);
      return tone(m, [0, 0, 6], [14, 8, -12], 1)
    }],
    ['superia', 'Superia 400', 'Film', function(m) {
      luts(m, curve([[0, 6], [64, 56], [128, 130], [192, 204], [255, 248]]));
      tone(m, [-8, 10, 4], [4, 0, 8], 1);
      hslAdj(m, {green: {s: 20, h: 10}, red: {s: 15}});
      return satm(m, 1.1)
    }],
    ['ektachrome', 'Ektachrome', 'Film', function(m) {
      mul(m, .97, 1, 1.05);
      luts(m, curve([[0, 0], [64, 52], [128, 130], [192, 210], [255, 255]]));
      hslAdj(m, {blue: {s: 30}, aqua: {s: 25}});
      return satm(m, 1.15)
    }],
    ['aerochrome', 'Aerochrome IR', 'Film', aerochrome],
    ['disposable', 'Disposable', 'Film', function(m) {
      mul(m, 1.06, 1, .9);
      luts(m, curve([[0, 10], [64, 54], [128, 132], [200, 214], [255, 248]]));
      satm(m, 1.15);
      light(m, .5, .42, .6, [255, 248, 235], .4);
      vig(m, .7);
      grain(m, .3, 21);
      return stamp(m, "'98 7 14")
    }],
    ['instax', 'Instax', 'Film', function(m) {
      luts(m, curve([[0, 34], [128, 146], [255, 244]]), curve([[0, 32], [128, 146], [255, 246]]), curve([[0, 44], [128, 146], [255, 238]]));
      satm(m, .88);
      tone(m, [-4, 4, 12], [6, 4, 0], 1);
      return glow(m, .15)
    }],
    ['mono', 'Classic B&W', 'B&W', function(m) {
      gray(m);
      return luts(m, curve([
        [0, 6],
        [64, 56],
        [128, 130],
        [192, 202],
        [255, 252]
      ]))
    }],
    ['noir', 'Noir', 'B&W', function(m) {
      gray(m, [.3, .6, .1]);
      luts(m, curve([
        [0, 0],
        [60, 18],
        [128, 118],
        [190, 222],
        [255, 255]
      ]));
      vig(m, .7);
      return grain(m, .3, 5)
    }],
    ['selenium', 'Selenium', 'B&W', function(m) {
      return gmap(m, [
        [0, [18, 10, 22]],
        [.45, [110, 90, 104]],
        [1, [246, 240, 230]]
      ])
    }],
    ['infrared', 'Infrared', 'B&W', function(m) {
      each(m, function(r, g, b, o) {
        o[0] = o[1] = o[2] = -.15 * r + 1.25 * g - .1 * b + 10
      });
      return glow(m, .55)
    }],
    ['redfilter', 'Red Filter B&W', 'B&W', function(m) {
      gray(m, [.95, .15, -.1]);
      return luts(m, curve([
        [0, 0],
        [100, 86],
        [200, 215],
        [255, 255]
      ]))
    }],
    ['sepia', 'Sepia', 'B&W', function(m) {
      return gmap(m, [
        [0, [28, 16, 6]],
        [.5, [156, 112, 70]],
        [1, [252, 236, 204]]
      ])
    }],
    ['cyanotype', 'Cyanotype', 'B&W', function(m) {
      return gmap(m, [
        [0, [8, 24, 64]],
        [.55, [40, 96, 168]],
        [1, [232, 242, 250]]
      ])
    }],
    ['trix', 'Tri-X 400', 'B&W', function(m) {
      gray(m, [.3, .59, .11]);
      luts(m, curve([[0, 4], [50, 26], [128, 128], [205, 228], [255, 255]]));
      clarity(m, .35);
      return grain(m, .55, 13)
    }],
    ['highkey', 'High-Key', 'B&W', function(m) {
      gray(m);
      luts(m, curve([[0, 40], [64, 120], [128, 190], [200, 240], [255, 255]]));
      return glow(m, .25)
    }],
    ['lowkey', 'Low-Key', 'B&W', function(m) {
      gray(m, [.3, .59, .11]);
      luts(m, curve([[0, 0], [80, 20], [160, 120], [230, 230], [255, 255]]));
      vig(m, 1);
      return clarity(m, .25)
    }],
    ['ortho', 'Orthochromatic', 'B&W', function(m) {
      gray(m, [-.12, .5, .62]);
      luts(m, curve([[0, 0], [64, 50], [190, 212], [255, 255]]));
      return grain(m, .2, 15)
    }],
    ['daguerreotype', 'Daguerreotype', 'B&W', daguerreotype],
    ['tealorange', 'Teal & Orange', 'Cinematic', function(m) {
      return tealOrange(m, 1)
    }],
    ['bleach', 'Bleach Bypass', 'Cinematic', function(m) {
      each(m, function(r, g, b, o) {
        var y = L(r, g, b),
          ov = function(c) {
            return y < 128 ? 2 * c * y / 255 : 255 - 2 * (255 - c) * (255 - y) / 255
          };
        o[0] = ov(r) * .55 + y * .45;
        o[1] = ov(g) * .55 + y * .45;
        o[2] = ov(b) * .55 + y * .45
      });
      return luts(m, curve([
        [0, 0],
        [64, 48],
        [190, 216],
        [255, 255]
      ]))
    }],
    ['matrix', 'Matrix', 'Cinematic', function(m) {
      mul(m, .78, 1.08, .8);
      luts(m, curve([
        [0, 0],
        [70, 38],
        [180, 200],
        [255, 245]
      ]));
      return tone(m, [-8, 18, 0], [0, 10, -10], 1)
    }],
    ['moonlight', 'Day for Night', 'Cinematic', function(m) {
      satm(m, .35);
      mul(m, .55, .68, .98);
      luts(m, curve([
        [0, 0],
        [128, 106],
        [255, 210]
      ]));
      return vig(m, .5)
    }],
    ['blockbuster', 'Blockbuster', 'Cinematic', function(m) {
      tealOrange(m, .75);
      luts(m, curve([
        [0, 0],
        [40, 18],
        [128, 128],
        [230, 240],
        [255, 250]
      ]));
      vig(m, .45);
      return bars(m)
    }],
    ['golden', 'Golden Hour', 'Cinematic', function(m) {
      mul(m, 1.1, 1, .82);
      light(m, .82, .08, .95, [255, 170, 80], .75);
      return glow(m, .4)
    }],
    ['cyber', 'Cyberpunk', 'Cinematic', function(m) {
      tone(m, [-10, 24, 48], [48, -12, 36], 1.2);
      satm(m, 1.3);
      luts(m, curve([
        [0, 0],
        [60, 38],
        [200, 222],
        [255, 255]
      ]));
      return glow(m, .4)
    }],
    ['desert', 'Desert Epic', 'Cinematic', function(m) {
      satm(m, .55);
      mix(m, gmap(cp(m), [[0, [30, 14, 6]], [.5, [190, 112, 48]], [1, [255, 236, 196]]]), .55);
      luts(m, curve([[0, 0], [64, 52], [192, 206], [255, 250]]));
      return vig(m, .4)
    }],
    ['storybook', 'Storybook', 'Cinematic', function(m) {
      luts(m, curve([[0, 30], [128, 146], [255, 250]]), curve([[0, 24], [128, 136], [255, 242]]), curve([[0, 30], [128, 124], [255, 226]]));
      hslAdj(m, {yellow: {s: 35}, red: {s: 20, h: 10}, green: {h: -20, s: -20}, aqua: {s: 20}});
      tone(m, [10, 0, 12], [12, 6, -4], 1);
      return satm(m, .95)
    }],
    ['thriller', 'Thriller', 'Cinematic', function(m) {
      satm(m, .55);
      mul(m, .94, 1.02, .86);
      luts(m, curve([[0, 0], [60, 34], [128, 120], [200, 210], [255, 240]]));
      tone(m, [-6, 10, 6], [6, 10, -12], 1);
      return vig(m, .45)
    }],
    ['western', 'Western', 'Cinematic', function(m) {
      satm(m, .5);
      mul(m, 1.12, 1, .8);
      luts(m, curve([[0, 8], [64, 46], [128, 130], [200, 222], [255, 250]]));
      clarity(m, .3);
      grain(m, .25, 17);
      return vig(m, .5)
    }],
    ['neonnoir', 'Neon Noir', 'Cinematic', function(m) {
      luts(m, curve([[0, 0], [90, 50], [200, 200], [255, 245]]));
      tone(m, [-10, 30, 60], [60, -20, 45], 1.3);
      satm(m, 1.35);
      return glow(m, .5)
    }],
    ['arctic', 'Arctic', 'Cinematic', function(m) {
      mul(m, .9, 1, 1.12);
      satm(m, .6);
      luts(m, curve([[0, 26], [128, 136], [255, 250]]));
      tone(m, [0, 6, 14], [0, 4, 10], 1);
      return clarity(m, .15)
    }],
    ['polaroid', 'Polaroid', 'Vintage', function(m) {
      luts(m, curve([
        [0, 30],
        [128, 140],
        [255, 240]
      ]), curve([
        [0, 24],
        [128, 134],
        [255, 236]
      ]), curve([
        [0, 40],
        [128, 128],
        [255, 210]
      ]));
      tone(m, [-6, 6, 14], [12, 6, -10], 1);
      satm(m, .85);
      return frame(m)
    }],
    ['seventies', '70s', 'Vintage', function(m) {
      mul(m, 1.08, .98, .78);
      luts(m, curve([
        [0, 32],
        [128, 132],
        [255, 232]
      ]));
      satm(m, .8);
      return hslAdj(m, {
        orange: {
          s: 30
        },
        yellow: {
          h: -20
        }
      })
    }],
    ['crossprocess', 'Cross Process', 'Vintage', function(m) {
      luts(m, curve([
        [0, 0],
        [64, 40],
        [128, 128],
        [192, 222],
        [255, 255]
      ]), curve([
        [0, 0],
        [64, 50],
        [128, 140],
        [192, 212],
        [255, 255]
      ]), curve([
        [0, 48],
        [128, 120],
        [255, 188]
      ]));
      return satm(m, 1.15)
    }],
    ['lomo', 'Lomo', 'Vintage', function(m) {
      var c = curve([
        [0, 0],
        [64, 38],
        [128, 130],
        [192, 222],
        [255, 255]
      ]);
      luts(m, c, c, curve([
        [0, 22],
        [128, 128],
        [255, 232]
      ]));
      satm(m, 1.35);
      return vig(m, .95)
    }],
    ['faded', 'Faded Matte', 'Vintage', function(m) {
      luts(m, curve([
        [0, 50],
        [64, 84],
        [128, 132],
        [255, 224]
      ]));
      satm(m, .7);
      return tone(m, [0, 4, 10], [8, 3, -4], 1)
    }],
    ['tintype', 'Tintype', 'Vintage', function(m) {
      gray(m);
      mix(m, blurRGB(m, Math.max(1, Math.round(Math.max(m.w, m.h) / 450))), .6);
      gmap(m, [
        [0, [20, 18, 14]],
        [.5, [112, 104, 86]],
        [1, [222, 214, 190]]
      ]);
      vig(m, .85);
      return grain(m, .4, 9)
    }],
    ['autochrome', 'Autochrome', 'Vintage', autochrome],
    ['technicolor', 'Technicolor', 'Vintage', function(m) {
      each(m, function(r, g, b, o) {
        var gb = (g + b) / 2;
        o[0] = r * 1.05;
        o[1] = gb;
        o[2] = gb
      });
      luts(m, curve([[0, 6], [64, 56], [192, 206], [255, 250]]));
      satm(m, 1.15);
      return tone(m, [0, 0, 0], [10, 6, -6], 1)
    }],
    ['vhs', 'VHS', 'Vintage', vhs],
    ['digicam', 'Digicam 2003', 'Vintage', function(m) {
      luts(m, curve([[0, 4], [100, 110], [200, 245], [235, 255], [255, 255]]));
      mul(m, .95, 1, 1.07);
      satm(m, 1.2);
      usm(m, 1.6, 1, 2);
      return light(m, .5, .45, .55, [255, 255, 255], .3)
    }],
    ['sunbleached', 'Sun-Bleached', 'Vintage', function(m) {
      luts(m, curve([[0, 30], [128, 128], [255, 226]]), curve([[0, 34], [128, 138], [255, 244]]), curve([[0, 44], [128, 140], [255, 238]]));
      hslAdj(m, {red: {s: -45}, orange: {s: -25}});
      return satm(m, .8)
    }],
    ['vivid', 'Vivid', 'Color Pop', function(m) {
      return adjust(m, {
        vibrance: 60,
        saturation: 10,
        contrast: 18,
        clarity: 35
      })
    }],
    ['splash', 'Color Splash', 'Color Pop', splash],
    ['neon', 'Neon Glow', 'Color Pop', function(m) {
      satm(m, 1.6);
      luts(m, curve([
        [0, 0],
        [80, 48],
        [255, 255]
      ]));
      return glow(m, .9)
    }],
    ['pastel', 'Pastel', 'Color Pop', function(m) {
      satm(m, .55);
      return each(m, function(r, g, b, o) {
        o[0] = r * .7 + 82;
        o[1] = g * .7 + 70;
        o[2] = b * .7 + 84
      })
    }],
    ['psych', 'Psychedelic', 'Color Pop', function(m) {
      hueRot(m, 150);
      return satm(m, 1.7)
    }],
    ['popart', 'Pop Art', 'Color Pop', function(m) {
      satm(m, 1.9);
      return post(m, 3)
    }],
    ['negative', 'Negative', 'Color Pop', function(m) {
      return each(m, function(r, g, b, o) {
        o[0] = 255 - r;
        o[1] = 255 - g;
        o[2] = 255 - b
      })
    }],
    ['cottoncandy', 'Cotton Candy', 'Color Pop', function(m) {
      luts(m, curve([[0, 24], [128, 140], [255, 250]]));
      tone(m, [10, 20, 58], [46, 6, 24], 1);
      satm(m, 1.05);
      return glow(m, .3)
    }],
    ['tropical', 'Tropical', 'Color Pop', function(m) {
      mul(m, 1.03, 1, .97);
      hslAdj(m, {aqua: {s: 55, h: -10}, blue: {s: 35}, green: {s: 40, h: -8}, yellow: {s: 30}, orange: {s: 20}});
      luts(m, curve([[0, 0], [64, 58], [192, 200], [255, 255]]));
      return satm(m, 1.08)
    }],
    ['orton', 'Orton Glow', 'Color Pop', orton],
    ['posterize', 'Posterize', 'Artistic', function(m) {
      return post(m, 5)
    }],
    ['halftone', 'Halftone', 'Artistic', halftone],
    ['pixel', 'Pixel Art', 'Artistic', pixel],
    ['sketch', 'Pencil Sketch', 'Artistic', sketch],
    ['duotone', 'Duotone', 'Artistic', function(m) {
      return gmap(m, [
        [0, [36, 18, 92]],
        [.5, [214, 58, 112]],
        [1, [255, 214, 120]]
      ])
    }],
    ['oil', 'Oil Paint', 'Artistic', function(m) {
      var o = kuwa(m, Math.max(2, Math.round(Math.max(m.w, m.h) / 200)));
      return satm(o, 1.15)
    }],
    ['emboss', 'Emboss', 'Artistic', emboss],
    ['edges', 'Neon Edges', 'Artistic', edges],
    ['thermal', 'Thermal', 'Artistic', function(m) {
      return gmap(m, [
        [0, [0, 0, 20]],
        [.2, [60, 0, 140]],
        [.45, [220, 0, 80]],
        [.65, [255, 110, 0]],
        [.85, [255, 230, 40]],
        [1, [255, 255, 255]]
      ])
    }],
    ['glitch', 'Glitch', 'Artistic', glitch],
    ['cartoon', 'Cartoon', 'Artistic', cartoon],
    ['tiltshift', 'Tilt-Shift', 'Artistic', tilt],
    ['chroma', 'Chromatic', 'Artistic', chroma],
    ['watercolor', 'Watercolor', 'Artistic', watercolor],
    ['crosshatch', 'Crosshatch', 'Artistic', hatch],
    ['risograph', 'Risograph', 'Artistic', riso],
    ['zoom', 'Zoom Burst', 'Artistic', zoomBurst],
    ['kaleidoscope', 'Kaleidoscope', 'Artistic', kaleido]
  ];
  var FM = {};
  FL.forEach(function(f) {
    FM[f[0]] = f[3]
  });

  /* ---- overlays & frames: textures, light, shadows and retro frames painted on top ---- */
  // Smooth value noise in 0..1 with separate cell sizes across and down.
  function vnoise(w, h, cx, cy, seed) {
    cx = Math.max(1, cx);
    cy = Math.max(1, cy);
    var gw = Math.ceil(w / cx) + 2,
      gh = Math.ceil(h / cy) + 2,
      G = new Float32Array(gw * gh),
      o = new Float32Array(w * h);
    for (var i = 0; i < G.length; i++) G[i] = hash(i * 7 + seed * 7919 + 13);
    for (var y = 0; y < h; y++) {
      var gy = y / cy,
        iy = gy | 0,
        fy = gy - iy;
      fy = fy * fy * (3 - 2 * fy);
      for (var x = 0; x < w; x++) {
        var gx = x / cx,
          ix = gx | 0,
          fx = gx - ix;
        fx = fx * fx * (3 - 2 * fx);
        var k = iy * gw + ix,
          a = G[k] + (G[k + 1] - G[k]) * fx,
          b = G[k + gw] + (G[k + gw + 1] - G[k + gw]) * fx;
        o[y * w + x] = a + (b - a) * fy
      }
    }
    return o
  }

  function fbm(w, h, cell, oct, seed) {
    var o = new Float32Array(w * h),
      amp = .5,
      tot = 0;
    for (var k = 0; k < oct; k++) {
      var n = vnoise(w, h, cell, cell, seed + k * 31);
      for (var i = 0; i < o.length; i++) o[i] += n[i] * amp;
      tot += amp;
      amp *= .5;
      cell = Math.max(1, cell / 2)
    }
    for (i = 0; i < o.length; i++) o[i] /= tot;
    return o
  }

  // Blend a colour field into the photo. A = per-pixel strength (or null for flat), mode 'screen' | 'mul' | 'add'.
  function blendCol(m, A, col, a, mode) {
    var d = m.d;
    for (var p = 0, i = 0; i < d.length; p++, i += 4) {
      var k = (A ? A[p] : 1) * a;
      if (k <= 0) continue;
      for (var c = 0; c < 3; c++) {
        var cc = typeof col === 'function' ? col(p, c) : col[c],
          v = d[i + c];
        d[i + c] = mode === 'mul' ? v * (1 - k + k * cc / 255) : mode === 'add' ? v + cc * k : 255 - (255 - v) * (1 - cc / 255 * k)
      }
    }
    return m
  }

  // Soft round dots (and optional stretched lines) into a strength map.
  function dot(A, w, h, cx, cy, r, v) {
    var x0 = Math.max(0, Math.floor(cx - r - 1)),
      x1 = Math.min(w - 1, Math.ceil(cx + r + 1)),
      y0 = Math.max(0, Math.floor(cy - r - 1)),
      y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
    for (var y = y0; y <= y1; y++)
      for (var x = x0; x <= x1; x++) {
        var t = 1 - ss(r * .5, r + .5, Math.hypot(x - cx, y - cy)) ;
        if (t > 0) A[y * w + x] = Math.max(A[y * w + x], t * v)
      }
  }

  function seedRand(seed) {
    var n = 0;
    return function() {
      return hash(seed * 104729 + (n++) * 7907 + 3)
    }
  }

  var OV = [
    ['paper', 'Paper', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        n = fbm(w, h, mn / 5, 4, sd),
        fib = vnoise(w, h, Math.max(1, mn / 260), Math.max(2, mn / 28), sd + 5),
        d = m.d;
      for (var p = 0, i = 0; i < d.length; p++, i += 4) {
        var g = (hash(p + sd * 999) - .5) * 14,
          tone = .86 + n[p] * .16 + (fib[p] - .5) * .1,
          P = [241, 233, 216];
        for (var c = 0; c < 3; c++) {
          var v = d[i + c] * .9 + 16;
          v = v * tone * P[c] / 255 + g;
          d[i + c] += (v - d[i + c]) * a
        }
      }
      return m
    }],
    ['dust', 'Dust', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        W = new Float32Array(w * h),
        D = new Float32Array(w * h),
        r = seedRand(sd),
        n = Math.round(w * h / 2600);
      for (var k = 0; k < n; k++) {
        var big = r() > .93;
        dot(r() > .2 ? W : D, w, h, r() * w, r() * h, (big ? 1.5 + r() * 2.5 : .4 + r() * 1.1) * Math.max(1, mn / 900), .5 + r() * .5)
      }
      // a few hairs
      for (k = 0; k < 6; k++) {
        var x = r() * w,
          y = r() * h,
          ang = r() * 6.3,
          len = mn * (.03 + r() * .08),
          A = r() > .5 ? W : D;
        for (var s = 0; s < len; s++) {
          ang += (r() - .5) * .25;
          x += Math.cos(ang);
          y += Math.sin(ang);
          dot(A, w, h, x, y, .6 * Math.max(1, mn / 900), .8)
        }
      }
      blendCol(m, W, [245, 242, 235], a, 'screen');
      return blendCol(m, D, [30, 26, 22], a * .9, 'mul')
    }],
    ['scratches', 'Scratches', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        W = new Float32Array(w * h),
        D = new Float32Array(w * h),
        r = seedRand(sd);
      for (var k = 0; k < 9; k++) {
        var x = r() * w,
          y0 = r() * h * .6,
          y1 = y0 + h * (.3 + r() * .7),
          A = r() > .35 ? W : D,
          v = .35 + r() * .6,
          dx = (r() - .5) * .04;
        for (var y = Math.max(0, y0 | 0); y < Math.min(h, y1); y++) {
          x += dx + (r() - .5) * .3;
          var xi = Math.round(x);
          if (xi >= 0 && xi < w) A[y * w + xi] = Math.max(A[y * w + xi], v * (.6 + .4 * r()))
        }
      }
      blendCol(m, W, [250, 248, 240], a, 'screen');
      return blendCol(m, D, [20, 18, 16], a * .8, 'mul')
    }],
    ['leak', 'Light Leak', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        r = seedRand(sd),
        side = Math.floor(r() * 4),
        along = .2 + r() * .6,
        cx = side === 0 ? -.1 : side === 1 ? 1.1 : along,
        cy = side === 2 ? -.1 : side === 3 ? 1.1 : along,
        R = Math.max(w, h),
        cols = [
          [255, 90, 20],
          [255, 170, 40],
          [255, 40, 60]
        ];
      return blendCol(m, null, function(p, c) {
        var x = (p % w) / w,
          y = ((p / w) | 0) / h,
          dd = Math.hypot((x - cx) * w, (y - cy) * h) / R,
          t = 1 - ss(.05, .75, dd),
          t2 = 1 - ss(0, .35, dd);
        return (cols[0][c] * t + cols[1][c] * t2 * .8 + cols[2][c] * t * (1 - t2) * .6) * Math.min(1, t * 1.4)
      }, a, 'screen')
    }],
    ['prism', 'Prism', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        r = seedRand(sd),
        ang = .5 + r() * 1.2,
        off = .15 + r() * .7,
        ca = Math.cos(ang),
        sa = Math.sin(ang),
        R = [];
      for (var i = 0; i < 64; i++) {
        var hh = i / 64 * 6;
        R.push([255 * Math.max(0, Math.min(1, Math.abs(hh - 3) - 1)), 255 * Math.max(0, Math.min(1, 2 - Math.abs(hh - 2))), 255 * Math.max(0, Math.min(1, 2 - Math.abs(hh - 4)))])
      }
      return blendCol(m, null, function(p, c) {
        var x = (p % w) / w - .5,
          y = ((p / w) | 0) / h - .5,
          u = x * ca + y * sa + .5 - off,
          band = 1 - ss(.0, .14, Math.abs(u));
        if (band <= 0) return 0;
        var k = Math.max(0, Math.min(63, Math.round((u / .28 + .5) * 63)));
        return R[k][c] * band * .85
      }, a, 'screen')
    }],
    ['flare', 'Sun Flare', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        r = seedRand(sd),
        fx = r() > .5 ? .82 : .18,
        fy = .12 + r() * .1,
        sx = fx * w,
        sy = fy * h,
        ghosts = [
          [.35, .05, [120, 255, 160]],
          [.6, .035, [255, 120, 200]],
          [.85, .08, [120, 180, 255]],
          [1.25, .05, [255, 200, 120]]
        ];
      return blendCol(m, null, function(p, c) {
        var x = p % w,
          y = (p / w) | 0,
          dd = Math.hypot(x - sx, y - sy) / mn,
          core = Math.exp(-dd * dd / .004),
          halo = Math.exp(-dd * dd / .09) * .55,
          ray = Math.pow(Math.abs(Math.cos(Math.atan2(y - sy, x - sx) * 6)), 40) * Math.exp(-dd / .25) * .35,
          v = [255, 236, 200][c] * (core + halo + ray);
        for (var g = 0; g < ghosts.length; g++) {
          var G = ghosts[g],
            gx = sx + (w / 2 - sx) * G[0] * 2,
            gy = sy + (h / 2 - sy) * G[0] * 2,
            gd = Math.hypot(x - gx, y - gy) / mn;
          v += G[2][c] * (1 - ss(G[1] * .7, G[1], gd)) * .22
        }
        return Math.min(255, v)
      }, a, 'screen')
    }],
    ['plastic', 'Plastic Wrap', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        n = fbm(w, h, mn / 2.2, 3, sd),
        n2 = fbm(w, h, mn / 5, 2, sd + 17),
        H = new Float32Array(w * h),
        d = m.d;
      // broad creases where two noise fields cross, softened so they read as sheen
      for (var q = 0; q < H.length; q++) {
        var r1 = 1 - Math.abs(2 * n[q] - 1),
          r2 = 1 - Math.abs(2 * n2[q] - 1);
        H[q] = Math.pow(r1, 9) * .45 + Math.pow(r1 * r2, 6) * .3 + Math.pow(r1, 2) * .05
      }
      H = blur1(H, w, h, Math.max(1, mn / 220));
      for (var p = 0, i = 0; i < d.length; p++, i += 4) {
        var hl = H[p];
        for (var c = 0; c < 3; c++) {
          var v = d[i + c] * .93 + 12;
          v = 255 - (255 - v) * (1 - Math.min(1, hl));
          d[i + c] += (v - d[i + c]) * a
        }
      }
      return m
    }],
    ['blinds', 'Blinds Shadow', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        r = seedRand(sd),
        ang = -.6 + r() * .5,
        per = mn * (.07 + r() * .04),
        ca = Math.cos(ang),
        sa = Math.sin(ang),
        S = new Float32Array(w * h);
      for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++) {
          var u = (x * ca + y * sa) / per;
          S[y * w + x] = ss(.42, .58, Math.abs(u - Math.floor(u) - .5) * 2)
        }
      S = blur1(S, w, h, Math.max(1, mn / 160));
      blendCol(m, S, [70, 62, 80], a * .75, 'mul');
      return blendCol(m, S.map(function(v) {
        return 1 - v
      }), [255, 190, 120], a * .25, 'screen')
    }],
    ['leaves', 'Leaf Shadow', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        n = fbm(w, h, mn / 3.5, 3, sd),
        n2 = vnoise(w, h, mn / 14, mn / 14, sd + 9),
        S = new Float32Array(w * h);
      for (var p = 0; p < S.length; p++) S[p] = ss(.47, .55, n[p] + (n2[p] - .5) * .18);
      S = blur1(S, w, h, Math.max(1, mn / 120));
      blendCol(m, S, [60, 70, 60], a * .7, 'mul');
      return blendCol(m, S.map(function(v) {
        return 1 - v
      }), [255, 200, 130], a * .22, 'screen')
    }],
    ['burn', 'Film Burn', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        r = seedRand(sd),
        right = r() > .5,
        n = fbm(w, h, mn / 5, 4, sd);
      return blendCol(m, null, function(p, c) {
        var x = (p % w) / w,
          e = (right ? x : 1 - x) + (n[p] - .5) * .5,
          t = ss(.55, 1, e);
        return [255, 120 + 120 * t * t, 40 + 200 * Math.pow(t, 4)][c] * Math.min(1, t * 1.5)
      }, a, 'screen')
    }],
    ['bokeh', 'Bokeh', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        r = seedRand(sd),
        cols = [
          [255, 200, 120],
          [255, 140, 170],
          [150, 200, 255],
          [255, 240, 200]
        ],
        L = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)];
      for (var k = 0; k < 26; k++) {
        var rad = mn * (.025 + r() * .05),
          cx = r() * w,
          cy = r() * h,
          A = L[Math.floor(r() * 4)],
          v = .35 + r() * .5,
          x0 = Math.max(0, cx - rad - 2 | 0),
          x1 = Math.min(w - 1, cx + rad + 2 | 0),
          y0 = Math.max(0, cy - rad - 2 | 0),
          y1 = Math.min(h - 1, cy + rad + 2 | 0);
        for (var y = y0; y <= y1; y++)
          for (var x = x0; x <= x1; x++) {
            var dd = Math.hypot(x - cx, y - cy) / rad,
              t = (1 - ss(.85, 1, dd)) * (.7 + .3 * ss(.6, .95, dd));
            if (t > 0) A[y * w + x] = Math.min(1, A[y * w + x] + t * v)
          }
      }
      for (k = 0; k < 4; k++) blendCol(m, L[k], cols[k], a, 'screen');
      return m
    }],
    ['sparkle', 'Sparkle', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        l = lum(m),
        S = new Float32Array(w * h),
        r = seedRand(sd),
        pts = [],
        step = Math.max(2, Math.round(mn / 60));
      // brightest spot in each cell of a coarse grid
      for (var gy = 0; gy < h; gy += step)
        for (var gx = 0; gx < w; gx += step) {
          var best = -1,
            bx = 0,
            by = 0;
          for (var y = gy; y < Math.min(h, gy + step); y++)
            for (var x = gx; x < Math.min(w, gx + step); x++)
              if (l[y * w + x] > best) {
                best = l[y * w + x];
                bx = x;
                by = y
              }
          pts.push([bx, by, best])
        }
      pts.sort(function(p, q) {
        return q[2] - p[2]
      });
      // glints on the brightest spots of the photo, spread out so they don't pile up
      var keep = [];
      for (var q = 0; q < pts.length && keep.length < 18; q++) {
        var P0 = pts[q];
        if (r() < .3 || keep.some(function(K) {
            return Math.hypot(K[0] - P0[0], K[1] - P0[1]) < mn * .14
          })) continue;
        keep.push(P0)
      }
      pts = keep;
      pts.forEach(function(P) {
        var len = mn * (.035 + r() * .06),
          rot = r() > .5 ? 0 : Math.PI / 4;
        for (var t = -len; t <= len; t += .5) {
          var f = Math.pow(1 - Math.abs(t) / len, 1.6);
          for (var j = 0; j < 2; j++) {
            var ang = rot + j * Math.PI / 2,
              x = Math.round(P[0] + Math.cos(ang) * t),
              y = Math.round(P[1] + Math.sin(ang) * t);
            if (x >= 0 && x < w && y >= 0 && y < h) S[y * w + x] = Math.max(S[y * w + x], f)
          }
        }
        dot(S, w, h, P[0], P[1], Math.max(1, mn / 400), 1)
      });
      S = blur1(S, w, h, 1);
      return blendCol(m, S.map(function(v) {
        return Math.min(1, v * 2.6)
      }), [255, 252, 240], a, 'screen')
    }],
    ['fringe', 'Chromatic Fringe', function(m, a, sd) {
      var w = m.w,
        h = m.h,
        d = m.d,
        s = cp(m).d,
        k = .006 + seedRand(sd)() * .006;
      for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++) {
          var dx = x - w / 2,
            dy = y - h / 2,
            xr = Math.min(w - 1, Math.max(0, Math.round(w / 2 + dx * (1 - k)))),
            yr = Math.min(h - 1, Math.max(0, Math.round(h / 2 + dy * (1 - k)))),
            xb = Math.min(w - 1, Math.max(0, Math.round(w / 2 + dx * (1 + k)))),
            yb = Math.min(h - 1, Math.max(0, Math.round(h / 2 + dy * (1 + k)))),
            i = (y * w + x) * 4;
          d[i] += (s[(yr * w + xr) * 4] - d[i]) * a;
          d[i + 2] += (s[(yb * w + xb) * 4 + 2] - d[i + 2]) * a
        }
      return m
    }]
  ];
  var OM = {};
  OV.forEach(function(o) {
    OM[o[0]] = o[2]
  });

  // Text for frames, drawn with a canvas when one is available (worker or page).
  function textLayer(w, h, items) {
    var c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (!c) return null;
    c.width = w;
    c.height = h;
    var x = c.getContext('2d');
    items.forEach(function(t) {
      x.font = t.font;
      x.textAlign = t.align || 'left';
      x.textBaseline = 'alphabetic';
      if (t.shadow) {
        x.fillStyle = 'rgba(0,0,0,.55)';
        x.fillText(t.s, t.x + t.shadow, t.y + t.shadow)
      }
      x.fillStyle = t.col;
      x.fillText(t.s, t.x, t.y)
    });
    return x.getImageData(0, 0, w, h).data
  }

  function stampText(m, items) {
    var T = textLayer(m.w, m.h, items);
    if (!T) return m;
    var d = m.d;
    for (var i = 0; i < d.length; i += 4) {
      var al = T[i + 3] / 255;
      if (!al) continue;
      d[i] += (T[i] - d[i]) * al;
      d[i + 1] += (T[i + 1] - d[i + 1]) * al;
      d[i + 2] += (T[i + 2] - d[i + 2]) * al
    }
    return m
  }

  // 1 inside a rounded rectangle, 0 outside, soft edge of `soft` px.
  function rrect(x, y, x0, y0, x1, y1, rad, soft) {
    var cx = Math.max(x0 + rad - x, 0, x - (x1 - rad)),
      cy = Math.max(y0 + rad - y, 0, y - (y1 - rad)),
      dd = Math.hypot(cx, cy) - rad;
    if (x < x0 || x > x1 || y < y0 || y > y1) dd = Math.max(dd, Math.max(x0 - x, x - x1, y0 - y, y - y1));
    return 1 - ss(-soft, soft, dd)
  }

  // Paint everything outside a gate shape with `col`, plus optional holes drawn on top.
  function gate(m, inside, col) {
    var w = m.w,
      h = m.h,
      d = m.d;
    for (var y = 0; y < h; y++)
      for (var x = 0; x < w; x++) {
        var t = 1 - inside(x, y);
        if (t <= 0) continue;
        var i = (y * w + x) * 4;
        d[i] += (col[0] - d[i]) * t;
        d[i + 1] += (col[1] - d[i + 1]) * t;
        d[i + 2] += (col[2] - d[i + 2]) * t
      }
    return m
  }

  function scanlines(m, k) {
    var w = m.w,
      d = m.d,
      per = Math.max(2, Math.round(m.h / 240));
    for (var i = 0, p = 0; i < d.length; i += 4, p++) {
      var y = (p / w) | 0;
      if (y % per) continue;
      d[i] *= 1 - k;
      d[i + 1] *= 1 - k;
      d[i + 2] *= 1 - k
    }
    return m
  }

  var MONO = '"Courier New", Courier, monospace',
    SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var FR = [
    ['super8', 'Super 8', function(m) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        bx = w * .07,
        by = h * .06,
        rad = mn * .07,
        hx = w * .025,
        hw = w * .03,
        hh = h * .09;
      vig(m, .35);
      gate(m, function(x, y) {
        return rrect(x, y, bx, by, w - bx, h - by, rad, mn * .006)
      }, [12, 10, 8]);
      gate(m, function(x, y) {
        return 1 - rrect(x, y, hx, h / 2 - hh / 2, hx + hw, h / 2 + hh / 2, hw * .3, 1)
      }, [236, 228, 210]);
      return grain(m, .18, 41)
    }],
    ['8mm', '8mm', function(m) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        bx = w * .09,
        by = h * .08;
      luts(m, curve([
        [0, 22],
        [128, 136],
        [255, 236]
      ]));
      OM.burn(m, .35, 7);
      OM.scratches(m, .6, 3);
      vig(m, .5);
      gate(m, function(x, y) {
        // softer, slightly barrel-shaped gate
        var u = (x / w - .5) * 2,
          v = (y / h - .5) * 2,
          e = Math.pow(Math.pow(Math.abs(u) / (1 - bx * 2 / w), 5) + Math.pow(Math.abs(v) / (1 - by * 2 / h), 5), .2);
        return 1 - ss(.97, 1.02, e)
      }, [8, 6, 4]);
      return grain(m, .3, 43)
    }],
    ['vhs', 'VHS', function(m) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        fs = Math.max(8, Math.round(mn * .055)),
        f = 'bold ' + fs + 'px ' + MONO;
      scanlines(m, .14);
      OM.fringe(m, .8, 2);
      return stampText(m, [{
        s: 'PLAY ▶',
        x: w * .05,
        y: h * .06 + fs,
        font: f,
        col: '#f4f4f4',
        shadow: Math.max(1, fs / 12)
      }, {
        s: 'SP',
        x: w * .95,
        y: h * .06 + fs,
        font: f,
        col: '#f4f4f4',
        align: 'right',
        shadow: Math.max(1, fs / 12)
      }, {
        s: '0:12:47',
        x: w * .05,
        y: h * .94,
        font: f,
        col: '#f4f4f4',
        shadow: Math.max(1, fs / 12)
      }, {
        s: 'JAN. 01 1999',
        x: w * .95,
        y: h * .94,
        font: f,
        col: '#f4f4f4',
        align: 'right',
        shadow: Math.max(1, fs / 12)
      }])
    }],
    ['vcr', 'VCR Camcorder', function(m) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        fs = Math.max(8, Math.round(mn * .05)),
        f = 'bold ' + fs + 'px ' + MONO,
        L = Math.round(mn * .08),
        T = Math.max(1, Math.round(mn * .006)),
        d = m.d,
        cx = w * .05 + fs * .35,
        cy = h * .07 + fs * .65;
      // focus brackets in the corners
      [
        [w * .1, h * .14, 1, 1],
        [w * .9, h * .14, -1, 1],
        [w * .1, h * .86, 1, -1],
        [w * .9, h * .86, -1, -1]
      ].forEach(function(c) {
        for (var k = 0; k < L; k++)
          for (var t = 0; t < T; t++) {
            [
              [c[0] + k * c[2], c[1] + t * c[3]],
              [c[0] + t * c[2], c[1] + k * c[3]]
            ].forEach(function(q) {
              var x = Math.round(q[0]),
                y = Math.round(q[1]);
              if (x < 0 || y < 0 || x >= w || y >= h) return;
              var i = (y * w + x) * 4;
              d[i] = d[i + 1] = d[i + 2] = 240
            })
          }
      });
      var red = new Float32Array(w * h);
      dot(red, w, h, cx, cy, fs * .32, 1);
      blendCol(m, red, [255, 40, 40], 1, 'mul');
      blendCol(m, red, [255, 30, 30], 1, 'screen');
      return stampText(m, [{
        s: 'REC',
        x: cx + fs * .55,
        y: h * .07 + fs,
        font: f,
        col: '#f4f4f4',
        shadow: Math.max(1, fs / 12)
      }, {
        s: '▮▮▮▯',
        x: w * .95,
        y: h * .07 + fs,
        font: f,
        col: '#f4f4f4',
        align: 'right',
        shadow: Math.max(1, fs / 12)
      }, {
        s: 'AM 10:24',
        x: w * .95,
        y: h * .93 - fs * 1.15,
        font: f,
        col: '#f4f4f4',
        align: 'right',
        shadow: Math.max(1, fs / 12)
      }, {
        s: 'JUL 14 1996',
        x: w * .95,
        y: h * .93,
        font: f,
        col: '#f4f4f4',
        align: 'right',
        shadow: Math.max(1, fs / 12)
      }])
    }],
    ['filmstrip', '35mm Strip', function(m) {
      var w = m.w,
        h = m.h,
        mn = Math.min(w, h),
        band = Math.round(h * .11),
        hw = mn * .035,
        hh = band * .42,
        gap = hw * 2.1,
        fs = Math.max(7, Math.round(band * .2));
      gate(m, function(x, y) {
        return y > band && y < h - band ? 1 : 0
      }, [14, 12, 10]);
      // sprocket holes in the black bands
      gate(m, function(x, y) {
        if (y > band && y < h - band) return 1;
        var yc = y < band ? band * .52 : h - band * .52,
          xi = ((x % gap) + gap) % gap - gap / 2;
        return 1 - rrect(xi, y, -hw / 2, yc - hh / 2, hw / 2, yc + hh / 2, hw * .25, 1)
      }, [226, 222, 214]);
      return stampText(m, [{
        s: 'NUANCE 400   ▸ 24   ▸ 24A',
        x: w * .04,
        y: band * .2 + fs * .2,
        font: 'bold ' + fs + 'px ' + SANS,
        col: '#f0a030'
      }, {
        s: '▸ 25          NUANCE 400          ▸ 25A',
        x: w * .04,
        y: h - band * .06,
        font: 'bold ' + fs + 'px ' + SANS,
        col: '#f0a030'
      }])
    }],
    ['border', 'White Border', function(m) {
      var w = m.w,
        h = m.h,
        b = Math.min(w, h) * .05;
      return gate(m, function(x, y) {
        return x >= b && x < w - b && y >= b && y < h - b ? 1 : 0
      }, [250, 249, 246])
    }]
  ];
  var FRM = {};
  FR.forEach(function(f) {
    FRM[f[0]] = f[2]
  });

  // st.fx = {ov: [{id, a (0-1), sd}], fr: frame id or null}
  function applyFx(m, fx) {
    (fx.ov || []).forEach(function(o) {
      if (OM[o.id] && o.a > 0) OM[o.id](m, Math.min(1, o.a), o.sd || 1)
    });
    if (fx.fr && FRM[fx.fr]) FRM[fx.fr](m);
    return m
  }

  /* ---- upscaler: separable Lanczos-3 / bicubic + edge-aware detail ---- */
  function kern(t) {
    if (t === 'bicubic') return {
      a: 2,
      f: function(x) {
        x = Math.abs(x);
        var A = -.5;
        return x < 1 ? ((A + 2) * x - (A + 3)) * x * x + 1 : x < 2 ? ((A * x - 5 * A) * x + 8 * A) * x - 4 * A : 0
      }
    };
    return {
      a: 3,
      f: function(x) {
        if (x === 0) return 1;
        if (x <= -3 || x >= 3) return 0;
        var p = Math.PI * x;
        return 3 * Math.sin(p) * Math.sin(p / 3) / (p * p)
      }
    }
  }

  function contrib(sn, dn, K) {
    var sc = dn / sn,
      fs = sc < 1 ? 1 / sc : 1,
      sup = K.a * fs,
      I = [],
      Wt = [];
    for (var x = 0; x < dn; x++) {
      var c = (x + .5) / sc - .5,
        lo = Math.floor(c - sup) + 1,
        hi = Math.floor(c + sup),
        ii = [],
        ww = [],
        tw = 0;
      for (var j = lo; j <= hi; j++) {
        var wv = K.f((c - j) / fs);
        if (!wv) continue;
        ii.push(Math.min(sn - 1, Math.max(0, j)));
        ww.push(wv);
        tw += wv
      }
      for (var k = 0; k < ww.length; k++) ww[k] /= tw;
      I.push(ii);
      Wt.push(ww)
    }
    return {
      I: I,
      W: Wt
    }
  }

  function resample(m, nw, nh, type) {
    var K = kern(type),
      cx = contrib(m.w, nw, K),
      cy = contrib(m.h, nh, K),
      w = m.w,
      h = m.h,
      d = m.d,
      t = new Float32Array(nw * h * 3),
      x, y, k;
    for (y = 0; y < h; y++)
      for (x = 0; x < nw; x++) {
        var I = cx.I[x],
          W = cx.W[x],
          r = 0,
          g = 0,
          b = 0;
        for (k = 0; k < I.length; k++) {
          var si = (y * w + I[k]) * 4,
            wv = W[k];
          r += d[si] * wv;
          g += d[si + 1] * wv;
          b += d[si + 2] * wv
        }
        var ti = (y * nw + x) * 3;
        t[ti] = r;
        t[ti + 1] = g;
        t[ti + 2] = b
      }
    var o = mk(nw, nh),
      od = o.d;
    for (y = 0; y < nh; y++) {
      var I2 = cy.I[y],
        W2 = cy.W[y];
      for (x = 0; x < nw; x++) {
        var r2 = 0,
          g2 = 0,
          b2 = 0;
        for (k = 0; k < I2.length; k++) {
          var tj = (I2[k] * nw + x) * 3,
            w2 = W2[k];
          r2 += t[tj] * w2;
          g2 += t[tj + 1] * w2;
          b2 += t[tj + 2] * w2
        }
        var oi = (y * nw + x) * 4;
        od[oi] = r2;
        od[oi + 1] = g2;
        od[oi + 2] = b2;
        od[oi + 3] = 255
      }
    }
    return o
  }

  // Safari refuses canvases over 16,777,216 pixels, so every output stays under MAX_PX.
  var MAX_PX = 16000000;

  function upSize(w, h, f) {
    var nw = Math.round(w * f),
      nh = Math.round(h * f);
    if (nw * nh > MAX_PX) {
      var k = Math.sqrt(MAX_PX / (nw * nh));
      nw = Math.floor(nw * k);
      nh = Math.floor(nh * k)
    }
    return [nw, nh]
  }

  function upscale(m, u) {
    var s = m;
    if (u.dn > 0) s = denoise(cp(m), u.dn / 100);
    var sz = upSize(s.w, s.h, u.f),
      o = resample(s, sz[0], sz[1], u.k),
      f = sz[0] / s.w;
    if (u.sharp > 0) {
      var a = u.sharp / 100;
      usm(o, a * 1.5, Math.max(1, f * .55), 1.2);
      usm(o, a * .6, Math.max(2, f * 1.5), 2)
    }
    return o
  }

  // AI upscaling runs outside the pipeline (TensorFlow.js on the main thread);
  // these are the steps before and after the model.
  function aiPrep(m, u) {
    var s = u.dn > 0 ? denoise(cp(m), u.dn / 100 * .6) : m,
      f = u.f;
    // Shrink the input if the result would pass the canvas limit.
    if (s.w * s.h * f * f > MAX_PX) {
      var k = Math.sqrt(MAX_PX / (s.w * s.h * f * f));
      s = resample(s, Math.floor(s.w * k), Math.floor(s.h * k), 'lanczos')
    }
    return s
  }

  function aiFinish(o, u) {
    if (u.sharp > 0) usm(o, u.sharp / 100 * .7, Math.max(1, u.f * .5), 1.5);
    return o
  }

  /* ---- masks: local adjustments ---- */
  // A mask is {type, inv, amt, v (adjust values + blur), ...shape}. Shapes live in
  // source-image fractions (0-1), so they stay attached to the photo through
  // crops and rotations:
  //   linear: x1,y1 (full effect) -> x2,y2 (none)   radial: cx,cy,rx,ry,feather
  //   brush: strokes [{p:[[u,v]...], r (fraction of long edge), soft, erase}]
  //   subject / background / face: read from aux.seg (AI segmentation grid).
  function brushGrid(strokes, aspect) {
    var gw = aspect >= 1 ? 768 : Math.max(8, Math.round(768 * aspect)),
      gh = aspect >= 1 ? Math.max(8, Math.round(768 / aspect)) : 768,
      a = new Float32Array(gw * gh),
      L = Math.max(gw, gh);
    strokes.forEach(function(st) {
      var rad = Math.max(.5, st.r * L),
        inner = rad * (1 - (st.soft == null ? .5 : st.soft)),
        pts = st.p;

      function stamp(cx, cy) {
        var x0 = Math.max(0, Math.floor(cx - rad)),
          x1 = Math.min(gw - 1, Math.ceil(cx + rad)),
          y0 = Math.max(0, Math.floor(cy - rad)),
          y1 = Math.min(gh - 1, Math.ceil(cy + rad));
        for (var y = y0; y <= y1; y++)
          for (var x = x0; x <= x1; x++) {
            var d = Math.sqrt((x + .5 - cx) * (x + .5 - cx) + (y + .5 - cy) * (y + .5 - cy));
            if (d >= rad) continue;
            var val = d <= inner ? 1 : 1 - ss(inner, rad, d),
              i = y * gw + x;
            if (st.erase) a[i] *= 1 - val;
            else if (val > a[i]) a[i] = val
          }
      }
      for (var k = 0; k < pts.length; k++) {
        var x = pts[k][0] * gw,
          y = pts[k][1] * gh;
        if (k === 0) {
          stamp(x, y);
          continue
        }
        var px = pts[k - 1][0] * gw,
          py = pts[k - 1][1] * gh,
          dist = Math.hypot(x - px, y - py),
          n = Math.ceil(dist / Math.max(.5, rad * .25));
        for (var j = 1; j <= n; j++) stamp(px + (x - px) * j / n, py + (y - py) * j / n)
      }
    });
    return {
      w: gw,
      h: gh,
      a: a,
      stride: 1,
      off: 0,
      scale: 1
    }
  }

  // Bilinear lookup in a grid {w,h,a,stride,off,scale} at source fractions (u,v).
  function sampleGrid(g, u, v) {
    var x = u * g.w - .5,
      y = v * g.h - .5;
    x = x < 0 ? 0 : x > g.w - 1 ? g.w - 1 : x;
    y = y < 0 ? 0 : y > g.h - 1 ? g.h - 1 : y;
    var ix = Math.min(g.w - 2, x | 0),
      iy = Math.min(g.h - 2, y | 0),
      fx = x - ix,
      fy = y - iy,
      a = g.a,
      S = g.stride,
      o = g.off,
      i = iy * g.w + ix;
    if (ix < 0) {
      ix = 0;
      fx = 0
    }
    return ((a[i * S + o] * (1 - fx) + a[(i + 1) * S + o] * fx) * (1 - fy) + (a[(i + g.w) * S + o] * (1 - fx) + a[(i + g.w + 1) * S + o] * fx) * fy) * g.scale
  }

  // B&W window box: centre {cx, cy} as fractions of the photo, half width bw (of its width),
  // half height bh (of its height), corners rounded by o.round (0-100).
  function winBox(mk, sw, sh) {
    var o = mk.win || {},
      hw = Math.max(1, (mk.bw || 0) * sw),
      hh = Math.max(1, (mk.bh || 0) * sh);
    return {
      x: mk.cx * sw,
      y: mk.cy * sh,
      hw: hw,
      hh: hh,
      r: Math.min(hw, hh) * (o.round == null ? 45 : o.round) / 100 * .5
    }
  }

  // Coverage of the rounded box at source pixel (x, y), antialiased over `px` source pixels.
  function winAlpha(b, x, y, px) {
    var qx = Math.abs(x - b.x) - (b.hw - b.r),
      qy = Math.abs(y - b.y) - (b.hh - b.r),
      d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - b.r;
    return 1 - ss(-px * .6, px * .6, d)
  }

  // The look inside a B&W window: crisp, cool black and white, with the picture zoomed and
  // shifted out of line with the photo around it. `al` is the window's coverage per pixel.
  // o: {x, y} shift (-100..100), zoom (0-100), bw amount (0-100).
  function winLook(m, al, o) {
    var w = m.w,
      h = m.h,
      mn = Math.min(w, h),
      bw = (o.bw == null ? 100 : o.bw) / 100,
      z = 1 + (o.zoom == null ? 10 : o.zoom) / 100 * .5,
      dx = (o.x == null ? 15 : o.x) / 100 * .2 * mn,
      dy = (o.y == null ? -10 : o.y) / 100 * .2 * mn,
      g = cp(m),
      cx = 0,
      cy = 0,
      n = 0,
      x, y, p;
    gray(g, [.22, .66, .12]);
    luts(g, curve([[0, 2], [50, 30], [128, 130], [200, 222], [255, 255]]));
    clarity(g, .3);
    tone(g, [-3, 0, 6], [-2, 0, 3], 1);
    if (bw < 1) mix(g, m, 1 - bw);
    // zoom around the middle of the window
    for (y = 0, p = 0; y < h; y++)
      for (x = 0; x < w; x++, p++)
        if (al[p] > 0) {
          cx += x * al[p];
          cy += y * al[p];
          n += al[p]
        }
    if (!n) return g;
    cx /= n;
    cy /= n;
    var o2 = cp(g),
      d = o2.d,
      gd = g.d;
    for (y = 0, p = 0; y < h; y++)
      for (x = 0; x < w; x++, p++) {
        if (al[p] <= 0) continue;
        var sx = Math.max(0, Math.min(w - 1.001, (x - cx) / z + cx - dx)),
          sy = Math.max(0, Math.min(h - 1.001, (y - cy) / z + cy - dy)),
          x0 = sx | 0,
          y0 = sy | 0,
          fx = sx - x0,
          fy = sy - y0,
          j = (y0 * w + x0) * 4,
          j2 = y0 < h - 1 ? j + w * 4 : j,
          i = p * 4;
        for (var c = 0; c < 3; c++) d[i + c] = (gd[j + c] * (1 - fx) + gd[j + 4 + c] * fx) * (1 - fy) + (gd[j2 + c] * (1 - fx) + gd[j2 + 4 + c] * fx) * fy
      }
    return o2
  }

  // A soft shadow just below the window so it looks like a card resting on the photo.
  function winShadow(m, al, amt) {
    if (amt <= 0) return;
    var w = m.w,
      h = m.h,
      sh = Math.max(2, Math.round(Math.min(w, h) * .03)),
      dn = Math.round(sh * .35),
      s = new Float32Array(w * h),
      d = m.d;
    for (var p = dn * w; p < s.length; p++) s[p] = al[p - dn * w];
    s = blur1(s, w, h, sh);
    for (var q = 0, i = 0; q < s.length; q++, i += 4) {
      var k = 1 - amt * .6 * Math.min(1, s[q] * 1.4) * (1 - al[q]);
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k
    }
  }

  // Mask strength (0-1) for every output pixel.
  function maskAlpha(mk, G, sw, sh, aux) {
    var ow = G.w,
      oh = G.h,
      A = G.m,
      out = new Float32Array(ow * oh),
      t = mk.type,
      grid = null;
    // Editable faces: one ellipse per face, {cx, cy} as fractions of the photo and
    // {rx, ry} as fractions of its width, rotated by ang (radians).
    var faces = t === 'face' && mk.faces ? mk.faces.map(function(f) {
      return {
        x: f.cx * sw,
        y: f.cy * sh,
        rx: Math.max(1, f.rx * sw),
        ry: Math.max(1, f.ry * sw),
        c: Math.cos(f.ang || 0),
        s: Math.sin(f.ang || 0)
      }
    }) : null;
    var win = t === 'window' ? winBox(mk, sw, sh) : null,
      erase = null;
    if (t === 'brush') grid = brushGrid(mk.strokes || [], sw / sh);
    else if (win) {
      // Painting adds to the window; erasing cuts into both the paint and the box.
      if (mk.strokes && mk.strokes.length) {
        grid = brushGrid(mk.strokes, sw / sh);
        erase = brushGrid(mk.strokes.filter(function(s) {
          return s.erase
        }).map(function(s) {
          return Object.assign({}, s, {
            erase: false
          })
        }), sw / sh)
      }
    } else if (!faces && (t === 'subject' || t === 'background' || t === 'face')) {
      var sg = aux && aux.seg;
      if (!sg) return null;
      grid = {
        w: sg.w,
        h: sg.h,
        a: sg.d,
        stride: 4,
        off: t === 'face' ? 1 : 0,
        scale: 1 / 255
      }
    }
    var lx = (mk.x2 - mk.x1) * sw,
      ly = (mk.y2 - mk.y1) * sh,
      len2 = lx * lx + ly * ly || 1,
      inner = 1 - (mk.feather == null ? .5 : mk.feather);
    for (var y = 0; y < oh; y++)
      for (var x = 0; x < ow; x++) {
        var u = (A[0] * (x + .5) + A[2] * (y + .5) + A[4]) / sw,
          v = (A[1] * (x + .5) + A[3] * (y + .5) + A[5]) / sh,
          a;
        if (t === 'linear') a = 1 - ss(0, 1, ((u - mk.x1) * sw * lx + (v - mk.y1) * sh * ly) / len2);
        else if (t === 'radial') {
          var dx = (u - mk.cx) / mk.rx,
            dy = (v - mk.cy) / mk.ry,
            d = Math.sqrt(dx * dx + dy * dy);
          a = inner >= 1 ? (d < 1 ? 1 : 0) : 1 - ss(inner, 1, d)
        } else if (faces) {
          a = 0;
          for (var fi = 0; fi < faces.length; fi++) {
            var F = faces[fi],
              px = u * sw - F.x,
              py = v * sh - F.y,
              ex = (px * F.c + py * F.s) / F.rx,
              ey = (-px * F.s + py * F.c) / F.ry,
              e = Math.sqrt(ex * ex + ey * ey),
              fa = e >= 1 ? 0 : inner >= 1 ? 1 : 1 - ss(inner, 1, e);
            if (fa > a) a = fa
          }
        } else if (win) {
          // B&W window: the box (less anything erased), plus anything painted
          a = winAlpha(win, u * sw, v * sh, Math.max(1, sw / ow));
          if (erase) a *= 1 - sampleGrid(erase, u, v);
          if (grid) a = Math.max(a, sampleGrid(grid, u, v))
        } else a = sampleGrid(grid, u, v);
        if (t === 'background') a = 1 - a;
        if (mk.inv) a = 1 - a;
        out[y * ow + x] = a * (mk.amt == null ? 1 : mk.amt)
      }
    return out
  }

  // Blur that only gathers colour from inside the mask, so a blurred background
  // doesn't pick up a halo from the sharp subject in front of it.
  function maskedBlur(m, al, r) {
    var w = m.w,
      h = m.h,
      n = w * h,
      d = m.d,
      R = new Float32Array(n),
      G = new Float32Array(n),
      B = new Float32Array(n);
    for (var p = 0, i = 0; p < n; p++, i += 4) {
      var a = al[p];
      R[p] = d[i] * a;
      G[p] = d[i + 1] * a;
      B[p] = d[i + 2] * a
    }
    R = blur1(R, w, h, r);
    G = blur1(G, w, h, r);
    B = blur1(B, w, h, r);
    var W = blur1(al, w, h, r),
      o = cp(m),
      od = o.d;
    for (p = 0, i = 0; p < n; p++, i += 4) {
      if (W[p] < .02) continue;
      od[i] = R[p] / W[p];
      od[i + 1] = G[p] / W[p];
      od[i + 2] = B[p] / W[p]
    }
    return o
  }

  // Blur for a mask. Backgrounds (and inverted masks) gather colour only from
  // inside the mask so the subject doesn't bleed in; anything else, like a face,
  // gets a plain blur so it keeps its shape instead of averaging to one flat colour.
  // The radius follows the size of the masked area, so a small face isn't wiped out.
  function maskBlur(m, al, k, behind) {
    var big = Math.max(m.w, m.h) / 28;
    if (behind) return maskedBlur(m, al, k * big);
    var area = 0;
    for (var p = 0; p < al.length; p++) area += al[p];
    return blurRGB(m, Math.max(1, k * Math.min(big, Math.sqrt(area) / 6)))
  }

  function applyMasks(m, masks, src, g, aux) {
    var G = geoMap(src.w, src.h, g);
    // Preview renders can run on a smaller image than the geometry expects; scale to fit.
    if (G.w !== m.w || G.h !== m.h) {
      var kx = G.w / m.w,
        ky = G.h / m.h,
        M = G.m;
      G = {
        w: m.w,
        h: m.h,
        m: [M[0] * kx, M[1] * kx, M[2] * ky, M[3] * ky, M[4], M[5]]
      }
    }
    masks.forEach(function(mk) {
      if (mk.off) return;
      var al = maskAlpha(mk, G, src.w, src.h, aux);
      if (!al) return;
      var v = mk.v || {},
        c;
      if (mk.type === 'window') {
        var o = mk.win || {};
        c = winLook(m, al, o);
        winShadow(m, al, (o.shadow == null ? 35 : o.shadow) / 100 * (mk.amt == null ? 1 : mk.amt))
      } else c = v.blur > 0 ? maskBlur(m, al, v.blur / 100, mk.type === 'background' || mk.inv) : cp(m);
      if (mk.type === 'window' && v.blur > 0) c = blurRGB(c, Math.max(1, v.blur / 100 * Math.max(m.w, m.h) / 28));
      adjust(c, v);
      var d = m.d,
        cd = c.d;
      for (var p = 0, i = 0; p < al.length; p++, i += 4) {
        var a = al[p];
        if (a <= 0) continue;
        d[i] += (cd[i] - d[i]) * a;
        d[i + 1] += (cd[i + 1] - d[i + 1]) * a;
        d[i + 2] += (cd[i + 2] - d[i + 2]) * a
      }
    });
    return m
  }

  // `cache` (optional, one per source image) keeps the geometry + enhance
  // result, which is the slowest part and rarely changes while dragging sliders.
  function render(src, st, cache, aux) {
    var key = JSON.stringify([st.geo, st.enh, !!st.skin]),
      m, base;
    if (cache && cache.src === src && cache.key === key) {
      m = cp(cache.m);
      base = cache.base;
    } else {
      m = geo(src, st.geo);
      if (m === src) m = cp(m);
      base = st.skin ? cp(m) : null;
      if (st.enh) enhance(m, st.enh);
      if (cache) {
        cache.src = src;
        cache.key = key;
        cache.m = cp(m);
        cache.base = base
      }
    }
    for (var i = 0; i < st.layers.length; i++) {
      var Ly = st.layers[i];
      if (Ly.t === 'adj') {
        adjust(m, Ly.v);
        // Local (masked) edits sit on top of the base adjustments, under the filters.
        if (i === 0 && st.masks && st.masks.length) applyMasks(m, st.masks, src, st.geo, aux)
      } else {
        var f = FM[Ly.id];
        if (!f || Ly.s <= 0) continue;
        var pre = cp(m),
          out = f(m);
        if (Ly.at && Ly.at.length) posMix(out, pre, Ly.s, Ly.at);
        else if (Ly.s < 1) mix(out, pre, 1 - Ly.s);
        m = out
      }
    }
    if (base) skinKeep(m, base, .85);
    if (st.fx) applyFx(m, st.fx);
    return m
  }
  return {
    geo: geo,
    geoMap: geoMap,
    render: render,
    maskAlpha: maskAlpha,
    brushGrid: brushGrid,
    upscale: upscale,
    aiPrep: aiPrep,
    aiFinish: aiFinish,
    copy: cp,
    upSize: upSize,
    curve: curve,
    MAX_PX: MAX_PX,
    analyze: analyze,
    resample: resample,
    FL: FL.map(function(f) {
      return [f[0], f[1], f[2]]
    }),
    OV: OV.map(function(o) {
      return [o[0], o[1]]
    }),
    FR: FR.map(function(f) {
      return [f[0], f[1]]
    })
  };
}
