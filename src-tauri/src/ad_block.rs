//! Ad-request blocking for the embedded YouTube iframe.
//!
//! IMPORTANT / HONEST NOTE:
//! There is no cross-platform Rust crate that intercepts sub-requests made
//! *inside* a webview's iframe (e.g. requests to googlevideo.com ad
//! endpoints, doubleclick.net, googlesyndication.com). This has to be done
//! per-OS, using the native webview's own content-blocking API. Tauri gives
//! you a handle to the native webview; you attach the platform API to that
//! handle. Below are the two real hooks and exactly which native API each
//! one needs. This file wires the *call site* — the native implementation
//! itself lives in Swift-callable / WebView2 config, referenced here.
//!
//! macOS (WKWebView):
//!   Use WKContentRuleListStore to compile a JSON block-list (same format
//!   Safari content blockers use) and add it via
//!   `WKUserContentController.add(_ contentRuleList:)`.
//!   Docs: https://developer.apple.com/documentation/webkit/wkcontentruleliststore
//!   Tauri hook: `tauri::WebviewWindow::with_webview` gives you the raw
//!   `WKWebView*` handle on macOS to call this from Objective-C/Swift glue.
//!
//! Windows (WebView2):
//!   Subscribe to `ICoreWebView2.WebResourceRequested` and call
//!   `WebResourceResponseView.Cancel()` (or return an empty response) for
//!   requests matching the block-list.
//!   Docs: https://learn.microsoft.com/microsoft-edge/webview2/reference/win32/icorewebview2#add_webresourcerequested
//!   Tauri hook: `tauri::WebviewWindow::with_webview` gives you the raw
//!   `ICoreWebView2*` handle on Windows for this.
//!
//! Both need `AddWebResourceRequestedFilter` / rule-list scoped to the
//! ad-serving domains in filters/easylist.txt (bundled, trimmed to just
//! domain-blocking rules — the full EasyList has CSS-hiding rules too,
//! which aren't relevant here since we're blocking network requests, not
//! hiding DOM elements).
//!
//! This module currently loads and parses the filter list so the native
//! glue code (added per-platform, see notes above) has a ready domain list
//! to consume. Wiring the actual OS-level call is the remaining step before
//! ad-blocking is functionally live.

use std::collections::HashSet;
use std::fs;

pub fn load_blocked_domains(filter_path: &str) -> HashSet<String> {
    let mut domains = HashSet::new();
    if let Ok(contents) = fs::read_to_string(filter_path) {
        for line in contents.lines() {
            let line = line.trim();
            // EasyList domain-block lines look like: ||doubleclick.net^
            if let Some(stripped) = line.strip_prefix("||") {
                if let Some(domain) = stripped.split('^').next() {
                    domains.insert(domain.to_string());
                }
            }
        }
    }
    domains
}

pub fn is_ad_request(url: &str, blocked_domains: &HashSet<String>) -> bool {
    blocked_domains.iter().any(|domain| url.contains(domain))
}
