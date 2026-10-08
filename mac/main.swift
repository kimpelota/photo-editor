// Studio de Nuance for Mac: the web editor in its own window, served from files
// inside the app so it works offline. Build with mac/build.sh.
import Cocoa
import UniformTypeIdentifiers
import WebKit

let scheme = "nuance"

// Serves the bundled web files at nuance://app/...
final class Files: NSObject, WKURLSchemeHandler {
  let root = Bundle.main.resourceURL!.appendingPathComponent("web")

  func webView(_ w: WKWebView, start task: WKURLSchemeTask) {
    guard let url = task.request.url else { return }
    var path = url.path
    if path.isEmpty || path == "/" { path = "/index.html" }
    let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
    guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
      task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
      return
    }
    let type = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    let res = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                              headerFields: ["Content-Type": type, "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!
    task.didReceive(res)
    task.didReceive(data)
    task.didFinish()
  }

  func webView(_ w: WKWebView, stop task: WKURLSchemeTask) {}
}

final class App: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate, WKScriptMessageHandler {
  var window: NSWindow!
  var web: WKWebView!
  let files = Files()

  func applicationDidFinishLaunching(_ n: Notification) {
    let cfg = WKWebViewConfiguration()
    cfg.setURLSchemeHandler(files, forURLScheme: scheme)
    // Lets the page know it's running as the installed app.
    cfg.userContentController.addUserScript(WKUserScript(
      source: "window.NUANCE_APP = true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
    cfg.userContentController.add(self, name: "nuance")
    // Reel Studio plays videos and its soundtrack from its own timeline, not from a click.
    cfg.mediaTypesRequiringUserActionForPlayback = []
    web = WKWebView(frame: .zero, configuration: cfg)
    web.uiDelegate = self
    web.navigationDelegate = self
    web.allowsMagnification = false

    window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1400, height: 900),
                      styleMask: [.titled, .closable, .miniaturizable, .resizable],
                      backing: .buffered, defer: false)
    window.title = "Studio de Nuance"
    window.minSize = NSSize(width: 420, height: 560)
    window.contentView = web
    window.setFrameAutosaveName("main")
    if !window.setFrameUsingName("main") { window.center() }
    window.makeKeyAndOrderFront(nil)
    buildMenu()
    web.load(URLRequest(url: URL(string: "\(scheme)://app/index.html")!))
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

  func buildMenu() {
    let main = NSMenu()
    let appItem = NSMenuItem()
    main.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "About Studio de Nuance", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Hide Studio de Nuance", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Quit Studio de Nuance", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu
    // Cut/copy/paste for text fields. Undo/redo stay with the editor's own Cmd+Z.
    let editItem = NSMenuItem()
    main.addItem(editItem)
    let edit = NSMenu(title: "Edit")
    edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit
    let winItem = NSMenuItem()
    main.addItem(winItem)
    let win = NSMenu(title: "Window")
    win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    win.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
    win.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
    winItem.submenu = win
    NSApp.mainMenu = main
  }

  @objc func reload() { web.reload() }

  // The page sends {icon: "data:image/png;base64,..."} whenever the theme changes.
  // It becomes the Dock icon now, and the app's icon in Finder (and the Dock when closed).
  var iconKey = ""
  func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {
    guard let body = m.body as? [String: Any], let s = body["icon"] as? String,
          let comma = s.firstIndex(of: ","), let data = Data(base64Encoded: String(s[s.index(after: comma)...])),
          let img = NSImage(data: data) else { return }
    NSApp.applicationIconImage = img
    let key = String(data.hashValue)
    if key == iconKey { return }
    iconKey = key
    let path = Bundle.main.bundlePath
    DispatchQueue.global(qos: .utility).async {
      _ = NSWorkspace.shared.setIcon(img, forFile: path, options: [])
    }
  }

  // File pickers: photos, plus videos and songs for Reel Studio and .cube LUTs.
  // The page checks what each picker accepts.
  func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo,
               completionHandler done: @escaping ([URL]?) -> Void) {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = p.allowsMultipleSelection
    panel.canChooseDirectories = false
    var types: [UTType] = [.image, .movie, .audio]
    if let cube = UTType(filenameExtension: "cube") { types.append(cube) }
    panel.allowedContentTypes = types
    panel.beginSheetModal(for: window) { r in done(r == .OK ? panel.urls : nil) }
  }

  // Microphone for Reel Studio voiceovers. macOS still asks the user the first time.
  @available(macOS 12.0, *)
  func webView(_ w: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame f: WKFrameInfo,
               type: WKMediaCaptureType, decisionHandler done: @escaping (WKPermissionDecision) -> Void) {
    done(type == .microphone ? .grant : .deny)
  }

  // Links that leave the app (GitHub, the website) open in the default browser.
  func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction,
               windowFeatures: WKWindowFeatures) -> WKWebView? {
    if let u = a.request.url { NSWorkspace.shared.open(u) }
    return nil
  }

  func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction,
               decisionHandler done: @escaping (WKNavigationActionPolicy) -> Void) {
    if a.shouldPerformDownload { return done(.download) }
    if let u = a.request.url, a.targetFrame?.isMainFrame == true, u.scheme == "https" || u.scheme == "http" {
      NSWorkspace.shared.open(u)
      return done(.cancel)
    }
    done(.allow)
  }

  // NUANCE_SELFTEST=1: runs each step's JavaScript, prints the result, then quits
  // (used to check a build). NUANCE_SNAP=<folder> also saves a screenshot after each step.
  let selftest: [(String, String, Double)] = [
    ("load", "[document.title, typeof PIPE, typeof renderMasks, (window.P && P.FL.length), typeof W, !!document.querySelector('#bApp'), (renderAppPop(), document.querySelector('#appPop').textContent.slice(0, 60))].join(' | ')", 0),
    ("photo", "document.querySelector('#bSample').click(); 1", 4),
    ("mask", "addMask('window'); [afterC.width + 'x' + afterC.height, S.masks.map(function(m){return m.type}).join(',')].join(' | ')", 3),
    ("icons", "(function(){var was=themeNow(),o=THEMES.map(function(t){setTheme(t[0]);return drawThemeIcon(256,true).toDataURL().length});setTheme(was);return JSON.stringify(o)})()", 1),
    ("media", "[typeof MediaRecorder, vidRecType(), 'secure=' + window.isSecureContext, 'mic=' + !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia), 'audio=' + !!(window.AudioContext || window.webkitAudioContext), 'idb=' + !!window.indexedDB].join(' | ')", 0),
    ("grade", "document.querySelector('.tab[data-t=adjust]').click(); setWheel('gain',[0.4,0.2,10]); schedule(); [typeof parseCube, !!document.querySelector('#wheels canvas')].join(' | ')", 2),
    ("example", "closeVid(); document.querySelector('.tab[data-t=outlines]').click(); openVid(2); 'opened'", 3),
    ("example-play", "[VID.t.toFixed(2), VID.on, VID.plan.clips, VID.c.width + 'x' + VID.c.height].join(' | ')", 0),
    ("studio", "closeVid(); reOpen(function(){ reTemplate(0) }); 'opening'", 3),
    ("studio-state", "[RE.proj.clips.length, reDur().toFixed(1) + 's', RE.proj.texts.length + ' texts', RE.proj.caps.words.length + ' words', JSON.stringify(RE.proj.music), $('#reelEd').hidden].join(' | ')", 0),
    ("studio-play", "RE.t = 1.2; rePlay(true); 'playing'", 2),
    ("studio-after", "rePlay(false); [RE.t.toFixed(2), RE.hit.length + ' text boxes'].join(' | ')", 1),
    ("studio-text", "RE.sel = null; reAct('text'); RE.panel = null; reRenderAll(); [RE.proj.texts.length, !!document.querySelector('#riTxt')].join(' | ')", 1),
    ("set", "reClose(); [typeof setAdd, SET.length, !!document.querySelector('#strip')].join(' | ')", 1)
  ]

  func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
    guard ProcessInfo.processInfo.environment["NUANCE_SELFTEST"] != nil else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) { self.runStep(0) }
  }

  func runStep(_ i: Int) {
    guard i < selftest.count else { NSApp.terminate(nil); return }
    let (name, js, wait) = selftest[i]
    web.evaluateJavaScript(js) { r, e in
      DispatchQueue.main.asyncAfter(deadline: .now() + wait) {
        print("SELFTEST", name, r.map { "\($0)" } ?? "nil", e.map { "ERROR \($0)" } ?? "")
        guard let dir = ProcessInfo.processInfo.environment["NUANCE_SNAP"] else { return self.runStep(i + 1) }
        self.web.takeSnapshot(with: nil) { img, _ in
          if let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
             let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(i)-\(name).png"))
          }
          self.runStep(i + 1)
        }
      }
    }
  }

  func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse,
               decisionHandler done: @escaping (WKNavigationResponsePolicy) -> Void) {
    done(r.canShowMIMEType ? .allow : .download)
  }

  func webView(_ w: WKWebView, navigationAction a: WKNavigationAction, didBecome d: WKDownload) { d.delegate = self }
  func webView(_ w: WKWebView, navigationResponse r: WKNavigationResponse, didBecome d: WKDownload) { d.delegate = self }

  // Exports save straight to Downloads, never overwriting an existing file.
  func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename name: String,
                completionHandler done: @escaping (URL?) -> Void) {
    let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
    let base = (name as NSString).deletingPathExtension, ext = (name as NSString).pathExtension
    var url = dir.appendingPathComponent(name), n = 2
    while FileManager.default.fileExists(atPath: url.path) {
      url = dir.appendingPathComponent("\(base) \(n)" + (ext.isEmpty ? "" : ".\(ext)"))
      n += 1
    }
    done(url)
  }

  func downloadDidFinish(_ d: WKDownload) {}
  func download(_ d: WKDownload, didFailWithError e: Error, resumeData: Data?) {
    NSAlert(error: e).beginSheetModal(for: window)
  }

  // JavaScript alert/confirm, in case the editor uses them.
  func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
               completionHandler done: @escaping () -> Void) {
    let a = NSAlert(); a.messageText = m; a.runModal(); done()
  }

  func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo,
               completionHandler done: @escaping (Bool) -> Void) {
    let a = NSAlert(); a.messageText = m; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
    done(a.runModal() == .alertFirstButtonReturn)
  }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
