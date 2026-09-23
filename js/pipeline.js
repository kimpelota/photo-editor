/* ============================================================
   IMAGE PIPELINE (runs in a Web Worker and on the main thread)
   ============================================================ */
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

  function geo(m, g) {
    if (!g) return m;
    var o = m,
      q = (((g.rot || 0) % 360) + 360) % 360 / 90;
    if (q) {
      var w = o.w,
        h = o.h,
        n = q % 2 ? mk(h, w) : mk(w, h),
        s = new Uint32Array(o.d.buffer, o.d.byteOffset, w * h),
        d = new Uint32Array(n.d.buffer),
        nw = n.w;
      for (var y = 0; y < h; y++)
        for (var x = 0; x < w; x++) {
          var nx, ny;
          if (q == 1) {
            nx = h - 1 - y;
            ny = x
          } else if (q == 2) {
            nx = w - 1 - x;
            ny = h - 1 - y
          } else {
            nx = y;
            ny = w - 1 - x
          }
          d[ny * nw + nx] = s[y * w + x]
        }
      o = n
    }
    if (g.fh || g.fv) {
      var w2 = o.w,
        h2 = o.h,
        n2 = mk(w2, h2),
        s2 = new Uint32Array(o.d.buffer, o.d.byteOffset, w2 * h2),
        d2 = new Uint32Array(n2.d.buffer);
      for (var y2 = 0; y2 < h2; y2++) {
        var sy = g.fv ? h2 - 1 - y2 : y2;
        for (var x2 = 0; x2 < w2; x2++) d2[y2 * w2 + x2] = s2[sy * w2 + (g.fh ? w2 - 1 - x2 : x2)]
      }
      o = n2
    }
    if (g.crop) {
      var p = g.crop.split(':').map(Number),
        t = p[0] / p[1],
        cw = o.w,
        ch = Math.round(o.w / t);
      if (ch > o.h) {
        ch = o.h;
        cw = Math.round(o.h * t)
      }
      var x0 = (o.w - cw) >> 1,
        y0 = (o.h - ch) >> 1,
        n3 = mk(cw, ch);
      for (var y3 = 0; y3 < ch; y3++) {
        var a = ((y3 + y0) * o.w + x0) * 4;
        n3.d.set(o.d.subarray(a, a + cw * 4), y3 * cw * 4)
      }
      o = n3
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
    ['chroma', 'Chromatic', 'Artistic', chroma]
  ];
  var FM = {};
  FL.forEach(function(f) {
    FM[f[0]] = f[3]
  });

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

  function upSize(w, h, f) {
    var nw = Math.round(w * f),
      nh = Math.round(h * f),
      lim = Math.max(nw, nh),
      cap = 4800;
    if (lim > cap) {
      var k = cap / lim;
      nw = Math.round(nw * k);
      nh = Math.round(nh * k)
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

  /* ---- full render ---- */
  function render(src, st) {
    var m = geo(src, st.geo);
    if (m === src) m = cp(m);
    var base = st.skin ? cp(m) : null;
    if (st.enh) enhance(m, st.enh);
    for (var i = 0; i < st.layers.length; i++) {
      var Ly = st.layers[i];
      if (Ly.t === 'adj') adjust(m, Ly.v);
      else {
        var f = FM[Ly.id];
        if (!f || Ly.s <= 0) continue;
        var pre = cp(m),
          out = f(m);
        if (Ly.s < 1) mix(out, pre, 1 - Ly.s);
        m = out
      }
    }
    if (base) skinKeep(m, base, .85);
    return m
  }
  return {
    geo: geo,
    render: render,
    upscale: upscale,
    upSize: upSize,
    analyze: analyze,
    resample: resample,
    FL: FL.map(function(f) {
      return [f[0], f[1], f[2]]
    })
  };
}
