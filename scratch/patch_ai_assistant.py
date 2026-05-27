# -*- coding: utf-8 -*-
import os

file_path = r"d:\CIC ERP\components\AIAssistant.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Định vị vị trí bắt đầu
# Ta tìm '  return (' xuất hiện sau 'const startResize = (e: React.MouseEvent) => {'
start_marker = "  return (\n    <div className={cn(\n      \"flex flex-col bg-white"
if start_marker not in content:
    # Thử marker ngắn hơn
    start_marker = "  return (\n    <div className={cn("

start_idx = content.find(start_marker)
if start_idx == -1:
    print("Error: Could not find start marker!")
    exit(1)

# Định vị vị trí kết thúc
# Ta tìm '  );\n};\n\nexport default AIAssistant;' ở cuối file
end_marker = "  );\n};\n\nexport default AIAssistant;"
end_idx = content.find(end_marker)
if end_idx == -1:
    end_marker = "  );\n};\nexport default AIAssistant;"
    end_idx = content.find(end_marker)
    if end_idx == -1:
        print("Error: Could not find end marker!")
        exit(1)

# Đoạn code mới thay thế
new_return_block = """  const isAdmin = _profile?.role === 'Admin' || _profile?.role === 'Leadership' || _profile?.role === 'Dev';
  const visibleTabs = AI_TABS.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className={cn(
      "flex h-full w-full bg-slate-55 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-all duration-300 overflow-hidden relative",
      isFullScreen ? "fixed inset-0 z-50 m-0" : "relative"
    )}>
      {/* ═══ Desktop Left Sidebar ═══ */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 shrink-0 select-none",
        isSidebarOpen ? "w-64" : "w-[68px]"
      )}>
        {/* Sidebar Header with Brand/Logo & Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 dark:shadow-none shrink-0 animate-pulse">
                <BrainCircuit size={16} />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-slate-850 dark:text-slate-100 text-sm truncate tracking-tight">AI Agent Hub</h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Trung tâm điều hành AI</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md mx-auto shrink-0">
              <BrainCircuit size={16} />
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto shrink-0">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as AITab)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer relative group",
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-none"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
                title={!isSidebarOpen ? tab.label : undefined}
              >
                <div className={cn("shrink-0", isActive ? "text-white" : "text-slate-400 dark:text-slate-550 group-hover:text-slate-600 dark:group-hover:text-slate-300")}>
                  {tab.icon}
                </div>
                {isSidebarOpen && (
                  <span className="truncate flex-1 text-left">{tab.label}</span>
                )}
                {!isSidebarOpen && (
                  <div className="absolute left-full ml-3 px-2 py-1 bg-slate-950 text-white text-[10px] font-bold rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                    {tab.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with Toggle Button */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center py-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            title={isSidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
        </div>
      </aside>

      {/* ═══ Main Content Container ═══ */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden bg-white dark:bg-slate-950">
        
        {/* ═══ Mobile Header & Horizonal Tabs ═══ */}
        <div className="md:hidden flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <BrainCircuit size={14} />
              </div>
              <h2 className="font-bold text-slate-850 dark:text-slate-100 text-sm">AI Agent Hub</h2>
            </div>
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          
          {/* Horizonal Tab bar (Mobile Scrollable) */}
          <div className="flex items-center overflow-x-auto px-2 pb-2 scrollbar-none gap-1 shrink-0">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as AITab)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0",
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Header Area (Desktop/Tablet) ═══ */}
        <header className="hidden md:flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10 shadow-sm">
          {/* Left: Active Tab Title or Chat Identity */}
          <div className="flex items-center gap-3 min-w-0">
            {activeTab === 'chat' ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 transition-colors duration-300",
                  dynamicAgents[currentAgent]?.color || "bg-indigo-600"
                )}>
                  {dynamicAgents[currentAgent]?.icon && React.createElement(dynamicAgents[currentAgent].icon, { size: 18 })}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-850 dark:text-slate-100 text-sm flex items-center gap-1.5 leading-none mb-1">
                    AI Agent Assistant
                    <span className="px-1.5 py-px rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase tracking-wider">v5</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[200px] md:max-w-[300px] flex items-center gap-1">
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dynamicAgents[currentAgent]?.color)}></span>
                      <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", dynamicAgents[currentAgent]?.color)}></span>
                    </span>
                    {dynamicAgents[currentAgent]?.name}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="text-indigo-600 dark:text-indigo-400 shrink-0">
                  {AI_TABS.find(t => t.id === activeTab)?.icon}
                </div>
                <h3 className="font-bold text-slate-850 dark:text-slate-100 text-sm">
                  {AI_TABS.find(t => t.id === activeTab)?.label}
                </h3>
              </div>
            )}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-1.5">
            {activeTab === 'chat' && (
              <>
                {/* Model Selector */}
                <div className="hidden md:block mr-1">
                  {['Admin', 'Leadership', 'Dev'].includes(_profile?.role || '') ? (
                    <select
                      value={currentModel}
                      onChange={(e) => setCurrentModel(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-205 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none border border-transparent transition-all"
                      title="Chọn Model AI"
                    >
                      <optgroup label="🖥️ Local AI (Bảo mật 100%)">
                        <option value="gemma-4-26b">💎 Gemma 4 26B</option>
                        <option value="qwen2.5-vl-7b">👁️ Qwen-VL 7B</option>
                      </optgroup>
                      <optgroup label="🔑 Cloud AI">
                        <option value="gemini-2.0-flash">✨ Gemini 2.0 Flash</option>
                        <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro</option>
                        <option value="gpt-4o">🤖 GPT-4o</option>
                        <option value="deepseek-chat">💬 DeepSeek V3</option>
                        <option value="deepseek-r1">🤔 DeepSeek R1</option>
                      </optgroup>
                    </select>
                  ) : (
                    <div className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                      <Database size={12} />
                      <span>Qwen 2.5 7B</span>
                    </div>
                  )}
                </div>
                <div className="hidden md:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>

                {/* Agent Selector Dropdown */}
                <div ref={agentMenuRef} className="relative">
                  <button
                    onClick={() => setShowAgentMenu(!showAgentMenu)}
                    className={cn(
                      "p-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-800",
                      showAgentMenu
                        ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                    title="Chọn Agent chuyên môn"
                  >
                    <Users size={15} />
                    <span className="hidden sm:inline">Phòng ban</span>
                    <ChevronDown size={12} />
                  </button>
                  {showAgentMenu && (
                    <div className="absolute top-full right-0 mt-1.5 w-[260px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl dark:shadow-black/40 z-50 py-1 overflow-hidden" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
                      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chọn Agent Chuyên Môn</p>
                      {Object.entries(dynamicAgents).map(([key, agent]) => {
                        const Icon = agent.icon;
                        const isActive = currentAgent === key;
                        return (
                          <button
                            key={key}
                            onClick={() => switchAgent(key)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer text-left",
                              isActive
                                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-bold"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                            )}
                          >
                            <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0", agent.color)}>
                              <Icon size={12} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs truncate leading-tight">{agent.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{agent.role}</div>
                            </div>
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* New Chat */}
                <button
                  onClick={newConversation}
                  className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  title="Cuộc trò chuyện mới"
                >
                  <Plus size={17} />
                </button>

                {/* History */}
                <button
                  onClick={() => { setShowHistory(!showHistory); if (!showHistory && _profile?.id) AiHistory.getConversations(_profile.id).then(c => setConversations(c)); }}
                  className={cn(
                    "p-2 rounded-lg transition-all cursor-pointer border",
                    showHistory 
                      ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" 
                      : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border-transparent"
                  )}
                  title="Lịch sử hội thoại"
                >
                  <Clock size={17} />
                </button>

                {/* Clear */}
                <button
                  onClick={clearChat}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                  title="Xóa lịch sử trò chuyện"
                >
                  <Trash2 size={17} />
                </button>
              </>
            )}

            {/* Fullscreen Button (Always show) */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
              title={isFullScreen ? "Thu nhỏ" : "Toàn màn hình"}
            >
              {isFullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </header>

        {/* ═══ Chat History Mobile/Desktop Subpanel ═══ */}
        {activeTab === 'chat' && showHistory && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 max-h-[30vh] overflow-y-auto shrink-0 z-10">
            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-150 dark:border-slate-800">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock size={13} className="text-indigo-500" /> Lịch sử hội thoại ({conversations.length})
              </p>
              <button onClick={() => setShowHistory(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer">
                <X size={14} />
              </button>
            </div>
            {conversations.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-400">Chưa có cuộc hội thoại nào</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs transition-colors cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-850 flex items-start gap-3 group",
                      activeConvId === conv.id && "bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500"
                    )}
                  >
                    <MessageSquare size={13} className="mt-0.5 text-slate-400 group-hover:text-indigo-500 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {conv.title || 'Cuộc hội thoại không có tiêu đề'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(conv.updated_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm('Xóa cuộc hội thoại này?')) {
                          await AiHistory.deleteConversation(conv.id);
                          setConversations(prev => prev.filter(c => c.id !== conv.id));
                          if (activeConvId === conv.id) newConversation();
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ Render Content Area dynamically based on activeTab ═══ */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* TAB 1: TRÒ CHUYỆN (CHAT) */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Tool Call Indicator Bubbles */}
              {activeToolCalls.length > 0 && (
                <div className="mx-4 md:mx-6 mt-3 flex flex-wrap gap-2 shrink-0">
                  {activeToolCalls.map((tool, i) => (
                    <div
                      key={`${tool}-${i}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-full text-xs text-violet-700 dark:text-violet-300 font-medium animate-pulse"
                    >
                      <Zap size={11} className="text-violet-500 shrink-0" />
                      <span className="font-mono">{tool}</span>
                      <span className="text-violet-400 dark:text-violet-500">•••</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Widget History Import Banner */}
              {widgetHistoryBanner && (
                <div className="mx-4 md:mx-6 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-850 rounded-xl flex items-center gap-3 shrink-0">
                  <span className="text-lg">📥</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Có lịch sử chat từ popup nhanh</p>
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400">Nhập vào để tiếp tục cuộc trò chuyện</p>
                  </div>
                  <button onClick={importWidgetHistory} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer">Nhập</button>
                  <button onClick={dismissWidgetHistory} className="p-1 text-indigo-400 hover:text-indigo-600 cursor-pointer"><X size={14} /></button>
                </div>
              )}

              {/* Messages Content Area */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                {React.useMemo(() => messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 md:gap-4 max-w-[95%] md:max-w-[85%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                      msg.role === 'user'
                        ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                        : cn("border-transparent text-white shadow-md shadow-indigo-200 dark:shadow-none", dynamicAgents[currentAgent]?.color)
                    )}>
                      {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>

                    <div 
                      id={`chat-bubble-${msg.id}`}
                      className={cn(
                      "group relative px-5 py-3.5 md:px-6 md:py-4 rounded-[20px] text-sm leading-relaxed shadow-sm",
                      msg.role === 'user'
                        ? "bg-indigo-600 text-white rounded-tr-sm"
                        : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-sm"
                    )}>
                      {msg.role === 'model' ? (
                        <div className="markdown-body">
                          {msg.content === '' && msg.isStreaming ? (
                            <span className="flex gap-1.5 items-center h-5">
                              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]"></span>
                              <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]"></span>
                            </span>
                          ) : (
                            <div className="prose prose-sm prose-indigo dark:prose-invert max-w-none break-words">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                urlTransform={(url: string) => url}
                                components={MARKDOWN_COMPONENTS as any}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}

                      {msg.role === 'model' && !msg.isStreaming && msg.content && (
                        <div className="absolute -bottom-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10" data-html2canvas-ignore="true">
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-pointer transition-colors"
                            title="Sao chép nội dung"
                          >
                            {copiedId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                          </button>

                          {msg.content.length > 50 && (
                            <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
                              <button
                                onClick={async () => {
                                  const tId = toast.loading('Đang chuẩn bị dữ liệu xuất file...');
                                  const prevMsgIndex = messages.findIndex(m => m.id === msg.id) - 1;
                                  const prevMsg = prevMsgIndex >= 0 ? messages[prevMsgIndex] : null;
                                  const fileName = await generateSmartFileName(prevMsg?.content || '', msg.content, currentModel);
                                  toast.loading('Đang xuất ra file HTML...', { id: tId });
                                  exportToHTML(`chat-bubble-${msg.id}`, fileName);
                                  toast.success('Đã tải xuống file HTML', { id: tId });
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                                title="Lưu file HTML"
                              >
                                <FileCode size={12} />
                              </button>
                              <button
                                onClick={async () => {
                                  const tId = toast.loading('Đang chuẩn bị dữ liệu xuất file...');
                                  const prevMsgIndex = messages.findIndex(m => m.id === msg.id) - 1;
                                  const prevMsg = prevMsgIndex >= 0 ? messages[prevMsgIndex] : null;
                                  const fileName = await generateSmartFileName(prevMsg?.content || '', msg.content, currentModel);
                                  toast.loading('Đang xuất ra file Word...', { id: tId });
                                  await exportToDOCX(msg.content, fileName, `chat-bubble-${msg.id}`);
                                  toast.success('Đã tải xuống file Word', { id: tId });
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                                title="Lưu file Word (DOCX)"
                              >
                                <FileText size={12} />
                              </button>
                              <button
                                onClick={async () => {
                                  const tId = toast.loading('Đang chuẩn bị dữ liệu xuất file...');
                                  const prevMsgIndex = messages.findIndex(m => m.id === msg.id) - 1;
                                  const prevMsg = prevMsgIndex >= 0 ? messages[prevMsgIndex] : null;
                                  const fileName = await generateSmartFileName(prevMsg?.content || '', msg.content, currentModel);
                                  toast.loading('Đang tải xuống ảnh...', { id: tId });
                                  await exportToImage(`chat-bubble-${msg.id}`, fileName);
                                  toast.success('Đã tải xuống file ảnh PNG', { id: tId });
                                }}
                                className="p-1.5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                                title="Lưu thành Ảnh (PNG)"
                              >
                                <ImageIcon size={12} />
                              </button>
                              <button
                                onClick={async () => {
                                  const tId = toast.loading('Đang chuẩn bị dữ liệu xuất file...');
                                  const prevMsgIndex = messages.findIndex(m => m.id === msg.id) - 1;
                                  const prevMsg = prevMsgIndex >= 0 ? messages[prevMsgIndex] : null;
                                  const fileName = await generateSmartFileName(prevMsg?.content || '', msg.content, currentModel);
                                  toast.loading('Đang sao chép ảnh...', { id: tId });
                                  await copyImageToClipboard(`chat-bubble-${msg.id}`, fileName);
                                  toast.success('Đã sao chép ảnh vào Clipboard (Zalo/Telegram)', { id: tId });
                                }}
                                className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors border-r border-slate-200 dark:border-slate-700 cursor-pointer"
                                title="Copy Ảnh để gửi Zalo/Telegram"
                              >
                                <ClipboardCopy size={12} />
                              </button>
                              <button
                                onClick={async () => {
                                  const tId = toast.loading('Đang nhờ AI nghĩ tên file...');
                                  const prevMsgIndex = messages.findIndex(m => m.id === msg.id) - 1;
                                  const prevMsg = prevMsgIndex >= 0 ? messages[prevMsgIndex] : null;
                                  const fileName = await generateSmartFileName(prevMsg?.content || '', msg.content, currentModel);
                                  toast.loading('Đang xuất ra file PDF...', { id: tId });
                                  await exportToPDF(`chat-bubble-${msg.id}`, fileName);
                                  toast.success('Đã tải xuống file PDF', { id: tId });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                                title="Lưu file PDF"
                              >
                                <FileDown size={12} />
                              </button>
                            </div>
                          )}

                          {msg.content.length > 50 && (
                            <button
                              onClick={async () => {
                                try {
                                  const titleVi = msg.content.substring(0, 60).replace(/[#*`]/g, '').trim() + '...';
                                  const slug = 'ai-post-' + Date.now();
                                  const htmlContent = await marked.parse(msg.content);
                                  await NewsService.create({
                                    titleVi,
                                    slug,
                                    contentVi: htmlContent,
                                    status: 'pending_approval'
                                  });
                                  toast.success('Đã gửi bài viết lên mục Tin tức chờ duyệt!');
                                } catch (e: any) {
                                  toast.error('Lỗi khi gửi bài: ' + (e.message || 'Error'));
                                }
                              }}
                              className="px-2 py-1.5 text-[10px] font-bold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:text-orange-600 hover:border-orange-200 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer group/btn"
                              title="Gửi bài lên CMS để đăng Đa kênh (Web, FB, LinkedIn, Email)"
                            >
                              <div className="flex items-center gap-1 opacity-70 group-hover/btn:opacity-100 transition-opacity">
                                <Globe size={12} className="text-blue-500" />
                                <Facebook size={12} className="text-blue-600" />
                                <Linkedin size={12} className="text-sky-600" />
                                <Mail size={12} className="text-emerald-500" />
                              </div>
                              Gửi duyệt đa kênh
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )), [messages, currentAgent, dynamicAgents, copiedId])}

                {/* Suggestion Chips */}
                {showSuggestions && (() => {
                  const lastContent = (lastMsg?.content || '').toLowerCase();
                  const quickActions: { label: string; icon: string; action: string }[] = [];

                  if (lastContent.includes('hợp đồng') || lastContent.includes('contract')) {
                    quickActions.push(
                      { label: 'HĐ quá hạn?', icon: '⚠️', action: 'Cho tôi xem danh sách hợp đồng quá hạn' },
                      { label: 'Xem công nợ', icon: '💰', action: 'Báo cáo công nợ hiện tại' },
                    );
                  }
                  if (lastContent.includes('doanh thu') || lastContent.includes('kpi') || lastContent.includes('revenue')) {
                    quickActions.push(
                      { label: 'So sánh quý', icon: '📊', action: 'So sánh doanh thu Q1 và Q2 năm nay' },
                      { label: 'Dự báo doanh thu', icon: '📈', action: 'Dự báo doanh thu năm nay dựa trên pipeline' },
                    );
                  }
                  if (lastContent.includes('task') || lastContent.includes('công việc') || lastContent.includes('giao việc')) {
                    quickActions.push(
                      { label: 'Ai đang bận?', icon: '👥', action: 'Xem khối lượng công việc của nhân viên' },
                    );
                  }
                  if (lastContent.includes('công nợ') || lastContent.includes('nợ')) {
                    quickActions.push(
                      { label: 'Dòng tiền', icon: '💸', action: 'Tổng hợp dòng tiền thu chi năm nay' },
                    );
                  }
                  if (quickActions.length === 0) {
                    quickActions.push(
                      { label: 'Bản tin sáng', icon: '🌅', action: 'Cho tôi xem bản tin sáng hôm nay' },
                      { label: 'Tổng quan KPI', icon: '📊', action: 'Cho tôi xem KPI tổng quan công ty' },
                      { label: 'HĐ quá hạn', icon: '⚠️', action: 'Có hợp đồng nào quá hạn không?' },
                      { label: 'Công nợ', icon: '💰', action: 'Báo cáo công nợ hiện tại' },
                      { label: 'Xếp hạng đơn vị', icon: '🏆', action: 'Xếp hạng đơn vị theo doanh thu' },
                    );
                  }
                  if (quickActions.length < 4) {
                    quickActions.push(
                      { label: 'Xuất báo cáo', icon: '📋', action: 'Xuất báo cáo tổng hợp tình hình kinh doanh' },
                    );
                  }

                  return (
                    <div className="flex flex-wrap gap-2 justify-center pt-3 pb-1 px-4 shrink-0">
                      {quickActions.slice(0, 4).map((qa, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(qa.action)}
                          className="group px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-violet-50 dark:hover:from-indigo-900/20 dark:hover:to-violet-900/20
                        border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600
                        rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-400
                        transition-all duration-200 cursor-pointer flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                        >
                          <span className="text-sm">{qa.icon}</span>
                          <span>{qa.label}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar Area */}
              <div className="p-2 md:p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 relative group/input-area">
                {/* Resizer Handle */}
                <div 
                  onMouseDown={startResize}
                  className="absolute top-0 left-0 right-0 h-2 -translate-y-1/2 cursor-ns-resize z-20 flex justify-center items-center opacity-0 group-hover/input-area:opacity-100 transition-opacity"
                  title="Kéo thay đổi chiều cao ô nhập liệu"
                >
                  <div className="w-12 h-1 bg-slate-300 dark:bg-slate-650 rounded-full"></div>
                </div>
                
                <div className="max-w-5xl mx-auto w-full">
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {attachedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium border border-indigo-100 dark:border-indigo-800/50">
                          <Paperclip size={12} />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-500 ml-1">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative flex items-center">
                    {showMentionDropdown && mentionResults.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                        <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                          Đề xuất tag
                        </div>
                        <div className="max-h-48 overflow-y-auto p-1">
                          {mentionResults.map((item, idx) => (
                            <button
                              key={`${item.type}-${item.id}`}
                              onClick={(e) => { e.preventDefault(); insertMention(item); }}
                              onMouseEnter={() => setMentionIndex(idx)}
                              className={cn(
                                "w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors",
                                idx === mentionIndex ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              <span className="text-base leading-none pt-0.5">{item.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate">{item.label}</div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.sublabel}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      className="hidden"
                      accept=".txt,.csv,.md,.json,.docx,image/*"
                      onChange={(e) => {
                        if (e.target.files) {
                          setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                    />

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer z-10"
                      title="Đính kèm tài liệu (.docx, .txt, .csv, hình ảnh)"
                    >
                      <Paperclip size={18} />
                    </button>

                    <textarea
                      ref={inputRef}
                      value={input}
                      style={{ height: promptHeight }}
                      onPaste={(e) => {
                        const items = e.clipboardData.items;
                        const filesToAttach: File[] = [];
                        for (let i = 0; i < items.length; i++) {
                          if (items[i].type.indexOf('image') !== -1) {
                            const file = items[i].getAsFile();
                            if (file) filesToAttach.push(file);
                          }
                        }
                        if (filesToAttach.length > 0) {
                          setAttachedFiles(prev => [...prev, ...filesToAttach]);
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInput(val);
                        const cursor = e.target.selectionStart;
                        const textBeforeCursor = val.slice(0, cursor);
                        const match = textBeforeCursor.match(/@([a-zA-Z0-9_\-\sàáãạảăắằẳẵặâấầẩẫậèéẹẻẽêềếểễệđìíĩỉịòóõọỏôốồổỗộơớờởỡợùúũụủưứừửữựỳỵỷỹýÀÁÃẠẢĂẮẰẲẴẶÂẤẦẨẪẬÈÉẸẺẼÊỀẾỂỄỆĐÌÍĨỈỊÒÓÕỌỎÔỐỒỔỖỘƠỚỜỞỠỢÙÚŨỤỦƯỨỪỬỮỰỲỴỶỸÝ]*)$/);
                        if (match) {
                          const query = match[1];
                          setMentionStartPos(match.index !== undefined ? match.index : null);
                          setShowMentionDropdown(true);
                          handleSearchMention(query);
                        } else {
                          setShowMentionDropdown(false);
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Hỏi AI hoặc tag dữ liệu (@) / đính kèm hợp đồng để phân tích..."
                      className="w-full pl-12 pr-14 py-3 bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-900 rounded-[20px] resize-none max-h-[50vh] min-h-[44px] overflow-y-auto shadow-sm text-sm font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors"
                      rows={1}
                      disabled={isTyping}
                    />

                    <button
                      onClick={isTyping ? handleStop : () => handleSend()}
                      disabled={!isTyping && !input.trim() && attachedFiles.length === 0}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer",
                        isTyping
                          ? "bg-rose-500 text-white shadow-lg hover:bg-rose-600 hover:scale-105 active:scale-95"
                          : (input.trim() || attachedFiles.length > 0)
                            ? "bg-indigo-600 text-white shadow-lg hover:scale-105 active:scale-95 animate-pulse"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                      )}
                      title={isTyping ? "Dừng" : "Gửi"}
                    >
                      {isTyping ? <StopCircle size={20} /> : <Send size={20} />}
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center mt-2 px-1 gap-2 max-w-5xl mx-auto w-full">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 cursor-pointer transition-colors font-semibold select-none">
                    <input 
                      type="checkbox" 
                      checked={isMultiLineMode} 
                      onChange={e => {
                        setIsMultiLineMode(e.target.checked);
                        localStorage.setItem('cic_ai_multi_line', e.target.checked.toString());
                      }} 
                      className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500/20 w-3 h-3 cursor-pointer" 
                    />
                    Chế độ nhiều dòng (Enter xuống dòng, Ctrl+Enter gửi)
                  </label>
                  <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    AI có thể cung cấp thông tin chưa chính xác. Vui lòng kiểm chứng lại các dữ liệu quan trọng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CẤU HÌNH AGENT (AGENTS) */}
          {activeTab === 'agents' && isAdmin && (
            <div className="h-full overflow-y-auto">
              <React.Suspense fallback={<LoadingState />}>
                <AgentManager />
              </React.Suspense>
            </div>
          )}

          {/* TAB 3: PHÂN QUYỀN AI (PERMISSIONS) */}
          {activeTab === 'permissions' && isAdmin && (
            <div className="h-full overflow-y-auto">
              <React.Suspense fallback={<LoadingState />}>
                <AIPermissionManager />
              </React.Suspense>
            </div>
          )}

          {/* TAB 4: CẤU HÌNH VECTOR (EMBEDDING) */}
          {activeTab === 'embedding' && isAdmin && (
            <div className="h-full overflow-y-auto">
              <React.Suspense fallback={<LoadingState />}>
                <EmbeddingSettings />
              </React.Suspense>
            </div>
          )}

          {/* TAB 5: GIÁM SÁT & CHI PHÍ (MONITORING) */}
          {activeTab === 'monitoring' && isAdmin && (
            <div className="h-full overflow-y-auto">
              <React.Suspense fallback={<LoadingState />}>
                <AIObservabilityDashboard />
              </React.Suspense>
            </div>
          )}

          {/* TAB 6: CẤU HÌNH API KEYS PHẲNG (API-KEYS) */}
          {activeTab === 'api-keys' && (
            <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950/40 py-8 px-4 md:px-8">
              <div className="max-w-4xl mx-auto space-y-6">
                
                {/* Header Title flat */}
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none shrink-0">
                    <KeyRound size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Cấu hình API Keys cá nhân</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bỏ qua giới hạn chung của hệ thống bằng cách cấu hình API Key và Local AI riêng của bạn.</p>
                  </div>
                </div>

                {/* Cloud API Keys Form Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                    <span className="w-2 h-4 rounded bg-indigo-500" />
                    Cloud API Keys (Khóa đám mây)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed font-medium">
                    Các khóa API được lưu trữ cục bộ tuyệt đối an toàn trên trình duyệt của bạn (localStorage) và chỉ được sử dụng cho các yêu cầu trực tiếp từ máy của bạn.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Google Gemini API Key</label>
                      <input
                        type="password"
                        value={customGeminiKey}
                        onChange={(e) => setCustomGeminiKey(e.target.value)}
                        placeholder="AIzaSy... (Để trống nếu dùng mặc định hệ thống)"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">OpenAI API Key (GPT-4o)</label>
                      <input
                        type="password"
                        value={customOpenAIKey}
                        onChange={(e) => setCustomOpenAIKey(e.target.value)}
                        placeholder="sk-proj-... (Để trống nếu dùng mặc định hệ thống)"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">DeepSeek API Key (R1/Chat)</label>
                      <input
                        type="password"
                        value={customDeepseekKey}
                        onChange={(e) => setCustomDeepseekKey(e.target.value)}
                        placeholder="sk-... (Để trống nếu dùng mặc định hệ thống)"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={saveSettings}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 cursor-pointer shadow-md shadow-indigo-150 dark:shadow-none transition-all flex items-center gap-2"
                    >
                      <Check size={14} />
                      Lưu API Keys đám mây
                    </button>
                  </div>
                </div>

                {/* Local AI Engine Card */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                    <span className="w-2 h-4 rounded bg-indigo-500" />
                    Local AI Configuration (Ollama / vLLM)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed font-medium">
                    Cấu hình và kiểm tra kết nối với các mô hình Local AI chạy trên máy của bạn hoặc máy chủ nội bộ. Dữ liệu sẽ được bảo mật 100% không rời khỏi hạ tầng của bạn.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">Ollama/vLLM Base URL</label>
                      <input
                        type="text"
                        value={localAIBaseURL}
                        onChange={(e) => setLocalAIBaseURL(e.target.value)}
                        placeholder="http://localhost:11434/v1"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={testLocalAI}
                        disabled={localAITesting}
                        className="flex-1 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {localAITesting ? (
                          <><span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /> Đang kết nối...</>
                        ) : (
                          <>🔍 Kiểm tra kết nối Local AI</>
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
                          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250 dark:border-emerald-800/80"
                          : "bg-rose-50 dark:bg-rose-950/20 border-rose-250 dark:border-rose-800/80"
                      )}>
                        {localAITestResult.ok ? (
                          <>
                            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">✅ Đã kết nối thành công với hệ thống Local AI — Phát hiện {localAITestResult.models.length} mô hình:</p>
                            <div className="max-h-36 overflow-y-auto space-y-1 pr-2">
                              {localAITestResult.models.map((m, i) => (
                                <p key={i} className="text-[10px] text-emerald-650 dark:text-emerald-400 font-mono">• {m}</p>
                              ))}
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">❌ Không kết nối được tới Ollama/vLLM</p>
                            <p className="text-[10px] text-rose-600 dark:text-rose-455 mt-1 leading-normal font-semibold">
                              Vui lòng đảm bảo dịch vụ Ollama đã được khởi chạy với lệnh: <code className="bg-rose-100 dark:bg-rose-900/30 px-1 rounded font-mono text-[9px] text-rose-700 dark:text-rose-300">ollama serve</code> và các thiết lập CORS phù hợp.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Hướng dẫn cách lấy API Key cá nhân */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <BookOpen size={16} className="text-indigo-500" />
                    Hướng dẫn lấy khóa API Keys cá nhân
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Gemini guide */}
                    <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/20 dark:bg-blue-950/10 p-4">
                      <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 mb-2">
                        🌟 Google Gemini API Key (Miễn phí)
                      </h4>
                      <ul className="list-decimal pl-4 text-[10px] text-slate-650 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                        <li>Truy cập <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 font-black hover:underline inline-flex items-center gap-0.5">Google AI Studio <ExternalLink size={8} /></a></li>
                        <li>Đăng nhập bằng tài khoản Google cá nhân.</li>
                        <li>Nhấn <strong>"Create API Key"</strong>.</li>
                        <li>Chọn hoặc tạo dự án mới để sinh Key.</li>
                        <li>Copy API Key có định dạng <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded font-mono text-[9px]">AIzaSy...</code> dán vào ô Gemini ở trên.</li>
                      </ul>
                    </div>

                    {/* OpenAI guide */}
                    <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-4">
                      <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
                        🤖 OpenAI API Key (GPT-4o - Trả phí)
                      </h4>
                      <ul className="list-decimal pl-4 text-[10px] text-slate-650 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                        <li>Đăng nhập vào <a href="https://platform.openai.com/signup" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 font-black hover:underline inline-flex items-center gap-0.5">OpenAI Platform <ExternalLink size={8} /></a></li>
                        <li>Nạp tối thiểu $5 tại mục <strong>Settings → Billing</strong>.</li>
                        <li>Vào tab <strong>API Keys</strong> → <strong>Create new secret key</strong>.</li>
                        <li>Đặt tên gợi nhớ (ví dụ: "CIC ERP").</li>
                        <li>Sao chép khóa bí mật và dán vào ô OpenAI ở trên.</li>
                      </ul>
                    </div>

                    {/* DeepSeek guide */}
                    <div className="rounded-xl border border-violet-100 dark:border-violet-900/40 bg-violet-50/20 dark:bg-violet-950/10 p-4 md:col-span-2">
                      <h4 className="text-xs font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1.5 mb-2">
                        💬 DeepSeek API Key (R1 / Chat - Cực rẻ & Thông minh)
                      </h4>
                      <ul className="list-decimal pl-4 text-[10px] text-slate-650 dark:text-slate-400 space-y-1 font-semibold leading-relaxed">
                        <li>Truy cập <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 font-black hover:underline inline-flex items-center gap-0.5">DeepSeek Platform <ExternalLink size={8} /></a> và tạo tài khoản.</li>
                        <li>Nạp tiền tối thiểu khoảng $2 để kích hoạt tài khoản API.</li>
                        <li>Truy cập tab <strong>API Keys</strong>, chọn <strong>Create new API key</strong>.</li>
                        <li>Sao chép Key (bắt đầu bằng <code className="bg-violet-100 dark:bg-violet-900/40 px-1 rounded font-mono text-[9px]">sk-...</code>) và dán vào ô cấu hình tương ứng ở trên.</li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );"""

# Thay thế
patched_content = content[:start_idx] + new_return_block + content[end_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(patched_content)

print("Successfully patched AIAssistant.tsx!")
