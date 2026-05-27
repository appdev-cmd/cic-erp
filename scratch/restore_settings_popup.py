# -*- coding: utf-8 -*-
import os

file_path = r"d:\CIC ERP\components\AIAssistant.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Thay thế AI_TABS để loại bỏ tab api-keys
old_tabs = """export const AI_TABS = [
  { id: 'chat', label: 'Trò chuyện', icon: <MessageSquare size={16} /> },
  { id: 'agents', label: 'Cấu hình Agent', icon: <Bot size={16} />, adminOnly: true },
  { id: 'permissions', label: 'Phân quyền AI', icon: <Shield size={16} />, adminOnly: true },
  { id: 'embedding', label: 'Cấu hình Vector', icon: <Sparkles size={16} />, adminOnly: true },
  { id: 'monitoring', label: 'Giám sát & Chi phí', icon: <BarChart3 size={16} />, adminOnly: true },
  { id: 'api-keys', label: 'Cấu hình API Keys', icon: <KeyRound size={16} /> },
] as const;"""

new_tabs = """export const AI_TABS = [
  { id: 'chat', label: 'Trò chuyện', icon: <MessageSquare size={16} /> },
  { id: 'agents', label: 'Cấu hình Agent', icon: <Bot size={16} />, adminOnly: true },
  { id: 'permissions', label: 'Phân quyền AI', icon: <Shield size={16} />, adminOnly: true },
  { id: 'embedding', label: 'Cấu hình Vector', icon: <Sparkles size={16} />, adminOnly: true },
  { id: 'monitoring', label: 'Giám sát & Chi phí', icon: <BarChart3 size={16} />, adminOnly: true },
] as const;"""

if old_tabs in content:
    content = content.replace(old_tabs, new_tabs)
    print("Replaced AI_TABS successfully!")
else:
    # Thử tìm dạng thu gọn
    print("Warning: old_tabs format not found exactly, will try generic replace...")
    content = content.replace("  { id: 'api-keys', label: 'Cấu hình API Keys', icon: <KeyRound size={16} /> },\n", "")

# 2. Thêm nút Settings vào Header Mobile
mobile_header_old = """          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <BrainCircuit size={14} />
              </div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm">AI Agent Hub</h2>
            </div>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-105 dark:hover:bg-slate-800 transition-all"
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>"""

# Ta tìm 'h2 className="font-bold text-slate-800' (đã được sửa typo sang text-slate-800 ở bước trước)
# Hãy check xem regex hay find chuỗi con
mobile_header_anchor = """            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100" """

# Để an toàn, hãy tìm và thay thế Header Mobile:
content = content.replace(
    'title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}\n            >\n              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}\n            </button>\n          </div>',
    'title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}\n            >\n              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}\n            </button>\n          </div>'
)

# Để làm an toàn, ta thay thế Header Desktop và Mobile:
# Hãy chèn nút Settings vào Desktop Header (trước nút Fullscreen Button (Always show))
desktop_header_anchor = """            {/* Fullscreen Button (Always show) */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}"""

desktop_header_replacement = """            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              title="Cấu hình API Keys cá nhân"
            >
              <Settings size={17} />
            </button>

            {/* Fullscreen Button (Always show) */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}"""

if desktop_header_anchor in content:
    content = content.replace(desktop_header_anchor, desktop_header_replacement)
    print("Inserted Desktop Settings Button successfully!")
else:
    print("Warning: Desktop header anchor not found!")

# Chèn nút Settings vào Mobile Header
# Hãy tìm vị trí mobile header và chèn nút:
mobile_anchor = """            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>"""

mobile_replacement = """            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Cấu hình API Keys cá nhân"
              >
                <Settings size={15} />
              </button>
              <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>"""

if mobile_anchor in content:
    content = content.replace(mobile_anchor, mobile_replacement)
    print("Inserted Mobile Settings Button successfully!")
else:
    print("Warning: Mobile header anchor not found!")

# 3. Gỡ bỏ phần render TAB 6 phẳng (api-keys) trong AIAssistant.tsx
# Ta tìm phần TAB 6 render:
flat_api_tab = """          {/* TAB 6: CẤU HÌNH API KEYS PHẲNG (API-KEYS) */}
          {activeTab === 'api-keys' && ("""

# Ta tìm vị trí của flat_api_tab trong file và gỡ bỏ toàn bộ nó cho đến thẻ đóng tương ứng.
# Để an toàn, hãy định vị flat_api_tab:
flat_tab_start = content.find(flat_api_tab)
if flat_tab_start != -1:
    # Tìm thẻ đóng của tab này. Vì tab này kết thúc ngay trước:
    #         </div>
    #       </main>
    #     </div>
    #   );
    # };
    #
    # export default AIAssistant;
    #
    # Nên ta tìm thẻ đóng bằng cách tìm '          )}\n\n        </div>\n      </main>'
    flat_tab_end_marker = "          )}\n\n        </div>\n      </main>"
    flat_tab_end = content.find(flat_tab_end_marker, flat_tab_start)
    if flat_tab_end != -1:
        # Gỡ bỏ
        content = content[:flat_tab_start] + content[flat_tab_end:]
        print("Removed Flat API Keys tab successfully!")
    else:
        # Thử end marker khác
        flat_tab_end_marker = "          )}\n        </div>\n      </main>"
        flat_tab_end = content.find(flat_tab_end_marker, flat_tab_start)
        if flat_tab_end != -1:
            content = content[:flat_tab_start] + content[flat_tab_end:]
            print("Removed Flat API Keys tab successfully (alt end marker)!")
        else:
            print("Error: Could not find end of Flat API Keys tab!")
            exit(1)
else:
    print("Warning: Flat API Keys tab section not found!")

# 4. Thêm Modal Popup showSettings ở trước thẻ đóng của main container
# Vị trí chèn là ngay trước:
#       </main>
#     </div>
#   );
# };
#
# export default AIAssistant;

modal_code = """      {/* ═══ Settings Modal Popup ════════════════════════════════ */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Settings size={18} className="text-indigo-500" />
                Cấu hình API Keys cá nhân
              </h3>
              <button
                onClick={() => { setShowSettings(false); setSettingsTab('config'); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs inside modal */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
              <button
                onClick={() => setSettingsTab('config')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold transition-all cursor-pointer relative",
                  settingsTab === 'config'
                    ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <KeyRound size={14} />
                Cloud API Keys
                {settingsTab === 'config' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('local')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold transition-all cursor-pointer relative",
                  settingsTab === 'local'
                    ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                🖥️ Local AI
                {settingsTab === 'local' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => setSettingsTab('guide')}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold transition-all cursor-pointer relative",
                  settingsTab === 'guide'
                    ? "text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <BookOpen size={14} />
                Hướng dẫn lấy Key
                {settingsTab === 'guide' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-slate-50 dark:bg-slate-950/40">
              
              {/* Tab 1: Cloud API Keys */}
              {settingsTab === 'config' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                    Nhập API Key cá nhân của bạn để sử dụng độc lập, vượt qua các giới hạn lưu lượng dùng chung của hệ thống.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Google Gemini API Key</label>
                      <input
                        type="password"
                        value={customGeminiKey}
                        onChange={(e) => setCustomGeminiKey(e.target.value)}
                        placeholder="AIzaSy... (Để trống để dùng cấu hình mặc định)"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">OpenAI API Key (GPT-4o)</label>
                      <input
                        type="password"
                        value={customOpenAIKey}
                        onChange={(e) => setCustomOpenAIKey(e.target.value)}
                        placeholder="sk-proj-... (Để trống để dùng cấu hình mặc định)"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">DeepSeek API Key (R1/Chat)</label>
                      <input
                        type="password"
                        value={customDeepseekKey}
                        onChange={(e) => setCustomDeepseekKey(e.target.value)}
                        placeholder="sk-... (Để trống để dùng cấu hình mặc định)"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Local AI Config */}
              {settingsTab === 'local' && (
                <div className="space-y-4">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
                    Cấu hình kết nối Ollama (Local AI). Dữ liệu hoàn toàn bảo mật trong mạng nội bộ của bạn.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Ollama Base URL</label>
                      <input
                        type="text"
                        value={localAIBaseURL}
                        onChange={(e) => setLocalAIBaseURL(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full px-4 py-2.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={testLocalAI}
                        disabled={localAITesting}
                        className="flex-1 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {localAITesting ? (
                          <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Đang kiểm tra...</>
                        ) : (
                          <>🔍 Kiểm tra kết nối</>
                        )}
                      </button>

                      <button
                        onClick={saveSettings}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-sm transition-all"
                      >
                        Lưu địa chỉ
                      </button>
                    </div>

                    {localAITestResult && (
                      <div className={cn(
                        "rounded-xl p-4 border transition-all duration-300",
                        localAITestResult.ok
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80"
                          : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/80"
                      )}>
                        {localAITestResult.ok ? (
                          <>
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">✅ Hệ thống Local AI (vLLM) sẵn sàng — {localAITestResult.models.length} models</p>
                            <div className="max-h-28 overflow-y-auto space-y-1 pr-2">
                              {localAITestResult.models.map((m, i) => (
                                <p key={i} className="text-[10px] text-emerald-600 dark:text-emerald-450 font-mono">• {m}</p>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-rose-700 dark:text-rose-350">❌ Không kết nối được Ollama</p>
                            <p className="text-[10px] text-rose-600 dark:text-rose-450 mt-1 leading-normal">Kiểm tra: <code className="bg-rose-100 dark:bg-rose-900/30 px-1 rounded font-mono text-[9px]">ollama serve</code> đã chạy chưa?</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Hướng dẫn lấy Key */}
              {settingsTab === 'guide' && (
                <div className="space-y-4 max-h-[50vh]">
                  <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 p-4">
                    <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-2">
                      🌟 Google Gemini API Key (Miễn phí)
                    </h4>
                    <ul className="list-decimal pl-4 text-[10px] text-slate-650 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                      <li>Truy cập <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-black hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink size={8} /></a></li>
                      <li>Đăng nhập bằng tài khoản Google cá nhân.</li>
                      <li>Nhấn <strong>"Create API Key"</strong> → copy mã <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded font-mono text-[9px]">AIzaSy...</code> dán vào ô Gemini.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-4">
                    <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                      🤖 OpenAI API Key (GPT-4o - Trả phí)
                    </h4>
                    <ul className="list-decimal pl-4 text-[10px] text-slate-650 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                      <li>Truy cập <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-black hover:underline inline-flex items-center gap-0.5">OpenAI Platform <ExternalLink size={8} /></a></li>
                      <li>Nạp tối thiểu $5 tại mục <strong>Billing</strong> để kích hoạt API.</li>
                      <li>Nhấn <strong>Create new secret key</strong> để sinh và sao chép Key.</li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/20 dark:bg-violet-950/10 p-4">
                    <h4 className="text-xs font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1.5 mb-2">
                      💬 DeepSeek API Key (R1 / Chat - Cực rẻ)
                    </h4>
                    <ul className="list-decimal pl-4 text-[10px] text-slate-650 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                      <li>Truy cập <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 font-black hover:underline inline-flex items-center gap-0.5">DeepSeek Platform <ExternalLink size={8} /></a></li>
                      <li>Nạp tiền (tối thiểu ~$2) → Vào tab <strong>API Keys</strong> để tạo mới.</li>
                    </ul>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => { setShowSettings(false); setSettingsTab('config'); }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all"
              >
                Hủy
              </button>
              <button
                onClick={saveSettings}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-md shadow-indigo-100 dark:shadow-none transition-all"
              >
                Lưu cài đặt
              </button>
            </div>

          </div>
        </div>
      )}
"""

main_container_end = """      </main>
    </div>
  );
};"""

# Ta chèn modal_code ngay trước main_container_end
if main_container_end in content:
    content = content.replace(main_container_end, modal_code + "\n" + main_container_end)
    print("Inserted Settings Modal successfully!")
else:
    print("Error: Could not find main container end to insert Modal Popup!")
    exit(1)

# Ghi lại file
with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Successfully restored API Keys Settings Popup!")
