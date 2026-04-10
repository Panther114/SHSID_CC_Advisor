<template>
  <div
    class="h-screen bg-[#F2F2F7] dark:bg-[#000000] text-[#1C1C1E] dark:text-[#F2F2F7] p-4 md:p-6 font-sans transition-colors duration-300 relative overflow-hidden flex flex-col antialiased selection:bg-[#007AFF]/30"
    @mousemove="updateMousePosition"
  >
    <!-- Header -->
    <header class="flex justify-between items-center mb-4 relative z-50 shrink-0 max-w-[1400px] mx-auto w-full px-2">
      <div class="flex flex-col">
        <h1 class="text-2xl md:text-[28px] font-semibold tracking-tight text-black dark:text-white leading-tight">
          {{ catalogData?.catalogName || 'Course Catalog Interactive' }}
        </h1>
        <p class="text-[#8E8E93] dark:text-[#98989D] mt-0.5 font-medium tracking-tight text-[11px] flex items-center gap-2">
          <span>{{ catalogData?.version || 'unknown version' }}</span>
          <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700"></span>
          <span>Updated {{ catalogData?.lastUpdated || 'unknown' }}</span>
        </p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Export Dropdown Button -->
        <div class="relative export-menu-container z-[200]" v-if="hasSelectedCourses">
          <button
            @click="showExportDropdown = !showExportDropdown"
            class="h-8 px-4 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-[#007AFF] font-medium transition-colors text-[13px] flex items-center gap-1.5 active:scale-95"
            :disabled="isExporting"
          >
            <svg v-if="isExporting" class="animate-spin h-3.5 w-3.5 text-[#007AFF]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            {{ isExporting ? 'Exporting...' : 'Export' }}
          </button>

          <!-- Pill-like Dropdown Pop-up -->
          <Transition name="tooltip-pop">
            <div v-if="showExportDropdown" class="absolute right-0 mt-2 w-40 bg-[#e5e5ea]/95 dark:bg-[#2C2C2E]/95 backdrop-blur-md border border-black/5 dark:border-white/10 rounded-xl shadow-md flex flex-col p-1 z-[200]">
              <button @click="triggerExport('png')" class="text-left px-3 py-1.5 text-[13px] font-medium hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors text-black dark:text-white">Export as PNG</button>
              <button @click="triggerExport('pdf')" class="text-left px-3 py-1.5 text-[13px] font-medium hover:bg-[#007AFF] hover:text-white rounded-lg transition-colors text-black dark:text-white">Export as PDF</button>
            </div>
          </Transition>
        </div>
        
        <button @click="toggleDarkMode" class="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-all text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white active:scale-95">
          <svg v-if="!isDarkMode" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
      </div>
    </header>

    <!-- Loading Skeleton -->
    <div v-if="!catalogData" class="w-full max-w-[1400px] mx-auto flex-1 min-h-0 bg-white dark:bg-[#1C1C1E] rounded-[20px] shadow-sm border border-black/5 dark:border-white/5 p-6 animate-pulse">
      <div class="h-8 bg-black/5 dark:bg-white/5 rounded-lg w-1/4 mb-8"></div>
      <div v-for="row in 4" :key="row" class="grid grid-cols-[140px_1fr_1fr_1fr_1fr] gap-4 mb-4">
        <div class="h-5 bg-black/5 dark:bg-white/5 rounded w-1/2 mt-2"></div>
        <div v-for="col in 4" :key="col" class="h-10 bg-black/5 dark:bg-white/5 rounded-lg"></div>
      </div>
    </div>

    <!-- Main App Container -->
    <div v-else ref="appContainer" class="flex-1 min-h-0 max-w-[1400px] mx-auto w-full bg-[#FFFFFF] dark:bg-[#1C1C1E] rounded-[20px] overflow-hidden shadow-2xl border border-black/10 dark:border-white/10 relative z-10 flex animate-fade-in-up">
      
      <!-- Left Sidebar (Subjects List) -->
      <div
        class="shrink-0 flex flex-col bg-[#F2F2F7] dark:bg-[#282829] z-20 transition-[margin-left] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative border-r border-black/10 dark:border-white/10"
        :style="{ width: leftPanelWidth + 'px', marginLeft: viewingCourseId ? -leftPanelWidth + 'px' : '0px' }"
        :class="[
          viewingCourseId ? 'pointer-events-none' : '',
          { 'no-transition': isResizingLeft }
        ]"
      >
        <!-- Pinned Search Bar -->
        <div class="h-14 px-4 flex items-center border-b border-black/5 dark:border-white/5 bg-[#F2F2F7]/95 dark:bg-[#282829]/95 backdrop-blur-xl sticky top-0 z-10 shrink-0">
          <div class="relative w-full group">
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 group-focus-within:text-[#007AFF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search"
              class="w-full pl-8 pr-3 py-1.5 rounded-xl border-none bg-black/5 dark:bg-black/20 focus:ring-2 focus:ring-[#007AFF] outline-none transition-all shadow-none placeholder-gray-500 text-[13px] font-medium text-black dark:text-white"
            />
          </div>
        </div>
        
        <!-- Scrollable Subject List -->
        <div class="flex-1 overflow-y-auto" :class="{ 'hide-scrollbar': selectedDept }" ref="leftScrollRef">
          <div class="py-2 pl-2 pr-3.5 space-y-0.5">
            <button
              v-for="dept in activeDepartments"
              :key="dept"
              @click="toggleDept(dept)"
              :class="[
                'w-full text-left px-3 h-9 rounded-lg text-[13px] font-medium line-clamp-1 flex items-center shrink-0',
                selectedDept === dept 
                  ? 'bg-[#007AFF] text-white shadow-sm' 
                  : 'text-gray-800 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10'
              ]"
            >
              {{ dept }}
            </button>
            <div v-if="activeDepartments.length === 0" class="px-3 py-6 text-center text-xs text-[#8E8E93] font-medium">
              No matches found
            </div>
          </div>
          <div class="px-4 pt-2 pb-4 text-[10px] text-gray-400 dark:text-gray-600 leading-tight">
            Frontend by Ziqian Huang, backend and UI optimizations by Will Chen
          </div>
        </div>

        <!-- Invisible Overlapping Left Resizer -->
        <div class="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30" @mousedown="startLeftResize"></div>
      </div>

      <!-- Center Content Area -->
      <div class="flex-1 min-w-0 flex flex-col relative bg-white dark:bg-[#1C1C1E] z-10 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
        
        <!-- Sticky Header (Grades) -->
        <div class="h-14 flex items-center border-b border-black/5 dark:border-white/5 sticky top-0 z-30 bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shrink-0">
          <button v-if="selectedDept" @click="selectedDept = null" class="absolute left-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white z-40">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div class="grid grid-cols-4 w-full h-full">
            <div v-for="grade in grades" :key="grade" class="flex items-center justify-center font-medium text-[13px] text-[#8E8E93] dark:text-[#98989D]">
              Grade {{ grade }}
            </div>
          </div>
        </div>

        <!-- Scrollable Main Grid -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden relative" ref="rightScrollRef" @click="handleContentAreaClick">
          
          <!-- Summary View Flow -->
          <div v-if="!selectedDept" class="p-2 space-y-0.5 relative pb-10">
            <div v-for="dept in visibleDepts" :key="dept" :ref="el => setDeptRowRef(dept, el as Element | null)" class="relative h-9 grid grid-cols-4 gap-4 px-2 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg transition-colors">
              
              <!-- SVG Connections -->
              <svg v-if="(deptArrowPaths[dept] || []).length > 0" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-[1] transition-opacity duration-200" :class="isAnimatingLayout ? 'opacity-0' : 'opacity-100'" aria-hidden="true">
                <path v-for="path in deptArrowPaths[dept]" :key="path.key" :d="path.d" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" :stroke-dasharray="path.variant === 'dashed' ? '4 4' : undefined" :class="path.variant === 'dashed' ? 'stroke-[2] stroke-[#FF9500] dark:stroke-[#FF9F0A]' : 'stroke-[1.5] stroke-[#007AFF] dark:stroke-[#0A84FF]'" />
              </svg>

              <!-- Grade Slots -->
              <div v-for="grade in grades" :key="grade" class="relative z-10 flex items-center justify-center h-full">
                <button
                  v-if="getCollapsedSummary(dept, grade)"
                  type="button"
                  @click="openCourseInfo(getCollapsedSummary(dept, grade)!.id)"
                  class="w-full h-7 px-2 rounded-[6px] border text-left text-[11px] font-medium leading-tight truncate transition-colors shadow-sm"
                  :class="getSummaryStyles(getCollapsedSummary(dept, grade)!.id)"
                  :ref="el => setCollapsedSummaryRef(dept, grade, el as Element | null)"
                >
                  {{ viewState[getCollapsedSummary(dept, grade)!.id]?.name || getCollapsedSummary(dept, grade)!.raw.name }}
                </button>
                <div v-else class="w-full h-7 rounded-[6px] border border-dashed border-black/10 dark:border-white/10 flex items-center justify-center text-[10px] font-medium text-[#8E8E93]/50 bg-black/[0.01] dark:bg-white/[0.01]" :ref="el => setCollapsedSummaryRef(dept, grade, el as Element | null)">
                  -
                </div>
              </div>
            </div>
          </div>

          <!-- Specific Select Flow -->
          <div v-else class="p-6 relative min-h-full pb-20">
            <div v-for="dept in visibleDepts" :key="dept" :ref="el => setDeptRowRef(dept, el as Element | null)" class="relative grid grid-cols-4 gap-5 h-full">
              
              <!-- SVG Connections -->
              <svg v-if="(deptArrowPaths[dept] || []).length > 0" class="pointer-events-none absolute inset-0 h-full w-full overflow-visible z-[1] transition-opacity duration-200" :class="isAnimatingLayout ? 'opacity-0' : 'opacity-100'" aria-hidden="true">
                <path v-for="path in deptArrowPaths[dept]" :key="path.key" :d="path.d" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" :stroke-dasharray="path.variant === 'dashed' ? '5 5' : undefined" :class="path.variant === 'dashed' ? 'stroke-[2] stroke-[#FF9500] dark:stroke-[#FF9F0A]' : 'stroke-[1.5] stroke-[#007AFF] dark:stroke-[#0A84FF]'" />
              </svg>

              <!-- Expanded Cards -->
              <div v-for="grade in grades" :key="grade" class="relative z-10 flex flex-col gap-3">
                <div v-for="course in getCourses(dept, grade)" :key="course.id" class="relative group" @mouseenter="hoveredCourseId = course.id; showTooltip(viewState[course.id]?.status === 'locked' && viewState[course.id]?.lockReason ? viewState[course.id]?.lockReason || '' : '')" @mouseleave="hoveredCourseId = null; hideTooltip()">
                  
                  <button
                    :ref="el => setCourseCardRef(course.id, el as Element | null)"
                    type="button"
                    @click="handleCourseClick(course.id)"
                    :class="[uiConfig.cardBase, getCardStyles(course.id)]"
                  >
                    <div class="pr-1">
                      <h3 class="font-semibold tracking-tight text-[13px] leading-[1.3]">{{ viewState[course.id]?.name || course.raw.name }}</h3>
                    </div>
                    <div class="w-full h-[3px] bg-black/5 dark:bg-white/10 rounded-full overflow-hidden mt-1" v-if="course.raw.crowdRating">
                      <div class="h-full rounded-full transition-all duration-300" 
                        :class="viewState[course.id]?.status === 'selected' ? 'bg-white/40' : 'bg-black/20 dark:bg-white/30'"
                        :style="{ width: `${(course.raw.crowdRating / 10) * 100}%` }"></div>
                    </div>
                  </button>

                  <!-- Floating Info & MoveUp Actions -->
                  <div class="absolute right-1.5 top-1.5 flex flex-col gap-1 z-20">
                    <button type="button" @click.stop="openCourseInfo(course.id)" :class="[uiConfig.iconBtn, viewState[course.id]?.isSelected ? 'bg-white border-transparent text-[#007AFF]' : 'border-black/10 dark:border-white/10 bg-white/95 dark:bg-white/10 text-gray-500 dark:text-white/85 hover:bg-white dark:hover:bg-white/20 hover:text-black dark:hover:text-white']">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8h.01M11 12h1v4h1m-1 5a9 9 0 110-18 9 9 0 010 18z" /></svg>
                    </button>
                    <button v-if="moveUpState.active && moveUpState.sourceId === course.id" type="button" @click.stop="cancelMoveUpMode" @mouseenter="showTooltip('Cancel move-up selection')" @mouseleave="hideTooltip" class="inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors bg-[#FF3B30] border-[#FF3B30] text-white hover:bg-[#FF453A] opacity-100">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <button v-else-if="!moveUpState.active && viewState[course.id]?.isSelected && viewState[course.id]?.moveUpAvailable && !viewState[course.id]?.isMoveUpSource" type="button" @click.stop="startMoveUp(course.id)" @mouseenter="showTooltip('Select a course to move up to')" @mouseleave="hideTooltip" class="inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors bg-white dark:bg-white/10 border-[#FF9500]/40 text-[#FF9500] dark:text-[#FF9F0A] hover:bg-orange-50 dark:hover:bg-[#FF9F0A]/20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
                      <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 17L17 7m0 0H9m8 0v8"></path></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Info Panel (Animated sliding from right) -->
      <div
        class="shrink-0 bg-[#F2F2F7] dark:bg-[#282829] z-20 flex flex-col transition-[margin-right] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative border-l border-black/10 dark:border-white/10"
        :style="{ width: rightPanelWidth + 'px', marginRight: viewingCourseId ? '0px' : -rightPanelWidth + 'px' }"
        :class="[
          !viewingCourseId ? 'pointer-events-none' : '',
          { 'no-transition': isResizingRight }
        ]"
      >
        <!-- Invisible Overlapping Right Resizer -->
        <div class="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30" @mousedown="startRightResize"></div>

        <div v-if="viewingCourseId" class="flex-1 overflow-y-auto hide-scrollbar p-4 flex flex-col h-full">
          <!-- Header -->
          <div class="flex justify-between items-start mb-4 gap-2">
            <div class="px-2 py-0.5 bg-blue-100 dark:bg-[#007AFF]/20 text-[#007AFF] dark:text-[#0A84FF] font-semibold text-[9px] uppercase tracking-wider rounded-md truncate">
              {{ activeRaw?.dept }} • G{{ activeVm?.grade || activeRaw?.grade }}
            </div>
            <button @click="viewingCourseId = null" class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-gray-500 hover:bg-black/10 dark:hover:bg-white/20 active:scale-95"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>

          <h2 class="text-lg font-semibold tracking-tight text-black dark:text-white leading-tight mb-5">{{ activeVm?.name || activeRaw?.raw.name }}</h2>

          <!-- Rating -->
          <div class="mb-5 rounded-[12px] border border-black/5 dark:border-white/5 p-3 bg-white/50 dark:bg-white/5 shadow-sm">
            <div class="flex justify-between items-end mb-2">
              <div>
                <div class="text-[9px] font-bold uppercase tracking-wider text-[#8E8E93]">Crowd Rating</div>
                <div class="text-xl font-bold text-black dark:text-white tracking-tight">
                  {{ formatRating(activeRaw?.raw.crowdRating) }}<span class="text-[10px] font-medium opacity-40 ml-0.5">/ 10</span>
                </div>
              </div>
            </div>
            <div class="h-1.5 w-full bg-black/5 dark:bg-black/40 rounded-full overflow-hidden">
              <div class="h-full bg-[#34C759] transition-all duration-300" :style="{ width: `${((activeRaw?.raw.crowdRating || 0) / 10) * 100}%` }"></div>
            </div>
          </div>

          <!-- MoveUp Status -->
          <div v-if="activeVm?.isMoveUpTarget" class="mb-5 py-2 px-3 rounded-lg border bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500] dark:text-[#FF9F0A]">
            <div class="text-[9px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
            <div class="font-medium text-[11px] mt-0.5 leading-tight">Moved up from {{ getCourseName(activeVm.moveUpSourceId) }}</div>
          </div>

          <div v-else-if="activeVm?.isMoveUpSource" class="mb-5 py-2 px-3 rounded-lg border bg-orange-50 border-orange-200 dark:bg-[#FF9500]/10 dark:border-[#FF9500]/30 text-orange-700 dark:text-[#FF9F0A]">
            <div class="text-[9px] font-bold uppercase tracking-widest opacity-80">Accelerated path</div>
            <div class="font-medium text-[11px] mt-0.5 leading-tight">Moved up to {{ getCourseName(activeVm.moveUpTargetId) }}</div>
            <button @click="removeMoveUp(viewingCourseId!)" class="mt-2 w-full py-1.5 rounded-md bg-[#FF9500] text-white text-[10px] font-bold hover:bg-[#FF9F0A] transition-colors shadow-sm">Cancel Move-Up</button>
          </div>

          <!-- Description & Notes -->
          <div class="space-y-4">
            <div>
              <h4 class="text-[9px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1 ml-0.5">Description</h4>
              <p class="text-[12px] text-gray-800 dark:text-gray-200 leading-relaxed bg-white/50 dark:bg-white/5 p-2.5 rounded-lg border border-black/5 dark:border-white/5">{{ activeRaw?.raw.description || 'No description available.' }}</p>
            </div>
            <div v-if="activeRaw?.raw.crowdReview">
              <h4 class="text-[9px] font-bold text-[#8E8E93] uppercase tracking-widest mb-1 ml-0.5">Notes</h4>
              <p class="text-[12px] text-gray-800 dark:text-gray-200 leading-relaxed bg-[#FF9500]/5 dark:bg-[#FF9500]/10 p-2.5 rounded-lg border border-[#FF9500]/10 dark:border-[#FF9500]/20">{{ activeRaw?.raw.crowdReview }}</p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- INVISIBLE EXPORT TARGET -->
    <div class="fixed top-0 left-[200vw] w-[1200px] pointer-events-none z-[-1]">
      <div ref="exportRef" class="w-full bg-white text-black p-12 flex flex-col font-sans">
        <div class="text-center mb-10">
          <h1 class="text-4xl font-semibold tracking-tight text-gray-900">4-Year Academic Plan</h1>
          <p class="text-gray-500 mt-2 font-medium">Generated by SHSID's Interactive Course Catalog</p>
        </div>

        <div class="grid grid-cols-[160px_1fr_1fr_1fr_1fr] gap-6 mb-6">
          <div class="font-bold text-gray-400 uppercase tracking-widest text-xs pt-2">Department</div>
          <div v-for="grade in grades" :key="grade" class="font-bold tracking-tight text-center text-xl text-gray-800 border-b border-gray-200 pb-3">Grade {{ grade }}</div>
        </div>

        <div v-for="(gradeMap, dept) in exportPlan" :key="dept" class="grid grid-cols-[160px_1fr_1fr_1fr_1fr] gap-6 py-6 border-b border-gray-100 relative">
          <!-- Flowline -->
          <div class="absolute left-[160px] right-10 top-1/2 h-[1px] bg-gray-200 -translate-y-1/2 z-0 rounded-full"></div>
          
          <div class="font-semibold text-gray-800 capitalize flex items-center bg-white z-10 pr-4 text-lg">{{ dept }}</div>

          <div v-for="grade in grades" :key="grade" class="relative z-10 flex flex-col gap-3 items-center justify-center w-full px-2">
            <template v-if="gradeMap && gradeMap[grade]?.length">
              <div v-for="course in gradeMap[grade]" :key="course.id" class="w-full p-4 rounded-xl shadow-sm relative border" :class="viewState[course.id]?.isMoveUpTarget ? 'bg-[#FEF9C3] border-[#EAB308] text-[#A16207]' : 'bg-[#F0F8FF] border-[#93C5FD] text-[#1E3A8A]'">
                <div class="font-semibold text-sm leading-snug">{{ viewState[course.id]?.name || course.raw.name }}</div>
                <div v-if="viewState[course.id]?.isMoveUpTarget" class="text-[10px] font-bold opacity-80 mt-1.5 tracking-wider">via {{ getCourseName(viewState[course.id]?.moveUpSourceId) }}</div>
              </div>
            </template>
            <div v-else class="w-3 h-3 rounded-full bg-gray-200 shadow-sm flex items-center justify-center"></div>
          </div>
        </div>

        <div class="mt-14 text-center text-[10px] text-gray-400 font-medium leading-relaxed">
          Content for reference only: please refer to the Course Catalog or talk to your homeroom teacher for accurate results!<br>
          Derived from extracted course data by Will Chen / frontend by Ziqian Huang
        </div>
      </div>
    </div>

    <div v-if="activeTooltip.visible" class="fixed z-[100] pointer-events-none" :class="tooltipThemeClass" :style="tooltipStyle">{{ activeTooltip.text }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { inject } from '@vercel/analytics';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { CourseSelectionController } from './backend/Controller';
import { Updater } from './backend/Updater';
import type { CourseModel, CourseNode } from './backend/CourseModel';
import type { CourseViewModel } from './backend/ViewModel';

interface CourseMeta { id: string; dept: string; grade: string; raw: CourseNode; searchText: string; }
interface ArrowPath { key: string; d: string; variant: 'solid' | 'dashed'; }
interface TooltipState { visible: boolean; text: string; theme?: 'default' | 'move-up'; }

const uiConfig = {
  cardBase: 'w-full min-h-[58px] text-left px-2.5 py-2 pr-6 rounded-xl relative overflow-hidden border transition-[transform,opacity,box-shadow,background-color,border-color] duration-200 flex flex-col justify-between gap-1 shadow-sm',
  iconBtn: 'inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-all duration-200 opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100'
};

const appContainer = ref<HTMLElement | null>(null);

const catalogData = ref<CourseModel | null>(null);
const viewState = ref<Record<string, CourseViewModel>>({});
const controller = ref<CourseSelectionController | null>(null);

const viewingCourseId = ref<string | null>(null);
const isDarkMode = ref<boolean>(false);
const searchQuery = ref<string>('');
const selectedDept = ref<string | null>(null);
const hoveredCourseId = ref<string | null>(null);

const tooltip = ref<TooltipState>({ visible: false, text: '', theme: 'default' });
const deptArrowPaths = ref<Record<string, ArrowPath[]>>({});

const showExportDropdown = ref(false);
const isExporting = ref(false);
const exportRef = ref<HTMLElement | null>(null);

const mouseX = ref(0);
const mouseY = ref(0);
const moveUpState = ref<{ active: boolean; sourceId: string | null; validTargets: string[]; }>({ active: false, sourceId: null, validTargets: [] });

// Resizable panels calculation based on precise DOM Rects
const leftPanelWidth = ref(240);
const rightPanelWidth = ref(240);
const isResizingLeft = ref(false);
const isResizingRight = ref(false);

const startLeftResize = (event: MouseEvent) => { 
  isResizingLeft.value = true; 
  window.addEventListener('mousemove', doLeftResize); 
  window.addEventListener('mouseup', stopLeftResize); 
  event.preventDefault(); 
};
const doLeftResize = (event: MouseEvent) => { 
  if (!isResizingLeft.value || !appContainer.value) return; 
  const rect = appContainer.value.getBoundingClientRect();
  leftPanelWidth.value = Math.max(180, Math.min(event.clientX - rect.left, 400)); 
};
const stopLeftResize = () => { 
  isResizingLeft.value = false; 
  window.removeEventListener('mousemove', doLeftResize); 
  window.removeEventListener('mouseup', stopLeftResize); 
};

const startRightResize = (event: MouseEvent) => { 
  isResizingRight.value = true; 
  window.addEventListener('mousemove', doRightResize); 
  window.addEventListener('mouseup', stopRightResize); 
  event.preventDefault(); 
};
const doRightResize = (event: MouseEvent) => { 
  if (!isResizingRight.value || !appContainer.value) return; 
  const rect = appContainer.value.getBoundingClientRect();
  rightPanelWidth.value = Math.max(180, Math.min(rect.right - event.clientX, 400)); 
};
const stopRightResize = () => { 
  isResizingRight.value = false; 
  window.removeEventListener('mousemove', doRightResize); 
  window.removeEventListener('mouseup', stopRightResize); 
};

// Sync Scrolling Refs
const leftScrollRef = ref<HTMLElement | null>(null);
const rightScrollRef = ref<HTMLElement | null>(null);
let isSyncingLeft = false;
let isSyncingRight = false;

const deptRowRefs = new Map<string, HTMLElement>();
const courseCardRefs = new Map<string, HTMLElement>();
const collapsedSummaryRefs = new Map<string, HTMLElement>();

let arrowFrame = 0;
let resizeObserver: ResizeObserver | null = null;
const isAnimatingLayout = ref(false);
let animationTimeout: any = null;

// Suspend graphic operations during layout shifts for perfectly smooth 60fps interaction
watch(viewingCourseId, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    isAnimatingLayout.value = true;
    if (animationTimeout) clearTimeout(animationTimeout);
    animationTimeout = setTimeout(() => {
      isAnimatingLayout.value = false;
      scheduleArrowRefresh();
    }, 500);
  }
});

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (showExportDropdown.value) showExportDropdown.value = false;
    else if (moveUpState.value.active) cancelMoveUpMode();
    else if (viewingCourseId.value) viewingCourseId.value = null;
  }
};

const closeDropdown = (e: Event) => {
  if (!(e.target as Element).closest('.export-menu-container')) {
    showExportDropdown.value = false;
  }
};

const updateMousePosition = (e: MouseEvent) => { mouseX.value = e.clientX; mouseY.value = e.clientY; };

// Scrolling sync logic
const onLeftScroll = (e: Event) => { if (isSyncingLeft) { isSyncingLeft = false; return; } if (rightScrollRef.value) { isSyncingRight = true; rightScrollRef.value.scrollTop = (e.target as HTMLElement).scrollTop; } };
const onRightScroll = (e: Event) => { if (isSyncingRight) { isSyncingRight = false; return; } if (leftScrollRef.value) { isSyncingLeft = true; leftScrollRef.value.scrollTop = (e.target as HTMLElement).scrollTop; } };

const setupScrollSync = (enable: boolean) => {
  const leftEl = leftScrollRef.value;
  const rightEl = rightScrollRef.value;
  if (!leftEl || !rightEl) return;
  leftEl.removeEventListener('scroll', onLeftScroll);
  rightEl.removeEventListener('scroll', onRightScroll);
  if (enable) {
    leftEl.addEventListener('scroll', onLeftScroll);
    rightEl.addEventListener('scroll', onRightScroll);
  }
};

watch(selectedDept, (dept) => setupScrollSync(dept === null), { flush: 'post' });

const grades = computed<string[]>(() => catalogData.value?.grades || []);

const allCourses = computed<CourseMeta[]>(() => {
  if (!catalogData.value) return [];
  const list: CourseMeta[] = [];
  for (const [dept, gradesObj] of Object.entries(catalogData.value.departments)) {
    const typedGradesObj = gradesObj as Record<string, CourseNode[]>;
    for (const [gradeLevel, courseArray] of Object.entries(typedGradesObj)) {
      if (!courseArray) continue;
      for (const course of courseArray) {
        list.push({ id: course.id, dept, grade: gradeLevel, raw: course, searchText: `${course.id} ${course.name || ''} ${course.track || ''} ${dept}`.toLowerCase() });
      }
    }
  }
  return list;
});

const courseMetaById = computed(() => { const map = new Map<string, CourseMeta>(); allCourses.value.forEach(course => map.set(course.id, course)); return map; });

const allCoursesByBucket = computed(() => {
  const buckets = new Map<string, CourseMeta[]>();
  allCourses.value.forEach(course => {
    const key = `${course.dept}::${course.grade}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(course);
    buckets.set(key, bucket);
  });
  return buckets;
});

const activeDepartments = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const matchedDepts = new Set<string>();
  allCourses.value.forEach(course => {
    if (!query || course.searchText.includes(query)) {
      matchedDepts.add(course.dept);
    }
  });
  return Array.from(matchedDepts);
});

watch(searchQuery, () => {
  if (selectedDept.value && !activeDepartments.value.includes(selectedDept.value)) {
    selectedDept.value = null;
  }
});

const visibleDepts = computed(() => selectedDept.value ? [selectedDept.value] : activeDepartments.value);

const collapsedDepts = computed(() => {
  if (selectedDept.value === null) {
    return new Set(activeDepartments.value);
  } else {
    const s = new Set(activeDepartments.value);
    s.delete(selectedDept.value);
    return s;
  }
});

const activeVm = computed(() => viewingCourseId.value ? viewState.value[viewingCourseId.value] : null);
const activeRaw = computed(() => viewingCourseId.value ? courseMetaById.value.get(viewingCourseId.value) || null : null);

const selectedPlan = computed(() => {
  const plan: Record<string, Record<string, CourseMeta[]>> = {};
  for (const course of allCourses.value) {
    const vm = viewState.value[course.id] as any;
    if (vm && vm.isSelected) {
      if (!plan[course.dept]) plan[course.dept] = {};
      const deptMap = plan[course.dept];
      if (deptMap && !deptMap[course.grade]) deptMap[course.grade] = [];
      deptMap?.[course.grade]?.push(course);
    }
  }
  return plan;
});

const exportPlan = computed(() => selectedPlan.value);
const hasSelectedCourses = computed(() => Object.keys(selectedPlan.value).length > 0);

const triggerExport = async (type: 'png' | 'pdf') => {
  if (!exportRef.value) return;
  isExporting.value = true;
  showExportDropdown.value = false;

  await nextTick();
  await new Promise(r => setTimeout(r, 150)); 

  try {
    const canvas = await html2canvas(exportRef.value, { 
      scale: 2, 
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: 1200
    });
    
    if (type === 'png') {
      canvas.toBlob(blob => {
        if(!blob) return;
        const url = URL.createObjectURL(blob);
        const newTab = window.open(url, '_blank');
        if (!newTab) {
          Object.assign(document.createElement('a'), { href: url, download: 'Academic_Plan.png' }).click();
        }
      }, 'image/png');
    } else {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      
      const pdfPageWidth = pdf.internal.pageSize.getWidth();
      const pdfPageHeight = pdf.internal.pageSize.getHeight();
      
      const ratio = canvas.width / canvas.height;
      let finalWidth = pdfPageWidth;
      let finalHeight = finalWidth / ratio;
      
      if (finalHeight > pdfPageHeight) {
        finalHeight = pdfPageHeight;
        finalWidth = finalHeight * ratio;
      }
      
      const xOffset = (pdfPageWidth - finalWidth) / 2;
      const yOffset = (pdfPageHeight - finalHeight) / 2;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const newTab = window.open(url, '_blank');
      if (!newTab) {
        Object.assign(document.createElement('a'), { href: url, download: 'Academic_Plan.pdf' }).click();
      }
    }
  } catch (error) {
    console.error('Failed to generate file:', error);
    alert("Failed to export. Please try again.");
  } finally {
    isExporting.value = false;
  }
};

const getCourses = (dept: string, grade: string) => {
  const allInBucket = allCoursesByBucket.value.get(`${dept}::${grade}`) || [];
  const query = searchQuery.value.trim().toLowerCase();
  return allInBucket.filter(c => !query || c.searchText.includes(query));
};

const getAllBucketCourses = (dept: string, grade: string) => allCoursesByBucket.value.get(`${dept}::${grade}`) || [];

const toggleDarkMode = () => { isDarkMode.value = !isDarkMode.value; document.documentElement.classList.toggle('dark', isDarkMode.value); };

const toggleDept = (dept: string) => { 
  selectedDept.value = selectedDept.value === dept ? null : dept; 
};

const openCourseInfo = (courseId: string) => viewingCourseId.value = courseId;

const startMoveUp = (courseId: string) => { if (!controller.value) return; const targets = controller.value.getValidMoveUpTargets(courseId); if (targets.length > 0) { moveUpState.value = { active: true, sourceId: courseId, validTargets: targets }; } };
const cancelMoveUpMode = () => { moveUpState.value = { active: false, sourceId: null, validTargets: [] }; };
const executeMoveUp = (targetId: string) => { if (moveUpState.value.sourceId) { controller.value?.setExplicitMoveUp(moveUpState.value.sourceId, targetId); cancelMoveUpMode(); } };
const removeMoveUp = (sourceId: string) => { controller.value?.removeExplicitMoveUp(sourceId); };

const handleCourseClick = (courseId: string) => {
  if (moveUpState.value.active) {
    if (moveUpState.value.validTargets.includes(courseId)) executeMoveUp(courseId);
    else if (courseId === moveUpState.value.sourceId) cancelMoveUpMode();
    return;
  }
  const vm = viewState.value[courseId];
  if (vm?.isMoveUpTarget) { openCourseInfo(courseId); return; }
  controller.value?.handleTap(courseId);
};

const handleContentAreaClick = (e: MouseEvent) => {
  if (!viewingCourseId.value) return;
  if ((e.target as HTMLElement).closest('button')) return;
  viewingCourseId.value = null;
};

const getCourseName = (courseId?: string): string => { if (!courseId) return 'Unknown'; return viewState.value[courseId]?.name || courseMetaById.value.get(courseId)?.raw.name || courseId; };

const activeTooltip = computed<TooltipState>(() => {
  if (moveUpState.value.active && moveUpState.value.sourceId) {
    const sourceName = courseMetaById.value.get(moveUpState.value.sourceId)?.raw.name || '';
    return { visible: true, text: `Select course to move-up to from ${sourceName}`, theme: 'move-up' };
  }
  return { ...tooltip.value, theme: 'default' };
});

const showTooltip = (text: string) => { if (!text) return; tooltip.value = { visible: true, text }; };
const hideTooltip = () => { tooltip.value.visible = false; };
const tooltipStyle = computed(() => {
  const gap = 8; const tooltipElWidth = activeTooltip.value.theme === 'move-up' ? 350 : 280; const tooltipElHeight = 96; const margin = 16;
  const x = mouseX.value; const y = mouseY.value;
  const placeLeft = x + gap + tooltipElWidth > window.innerWidth - margin;
  const placeAbove = y + gap + tooltipElHeight > window.innerHeight - margin;
  const left = placeLeft ? x - tooltipElWidth - gap : x + gap;
  const top = placeAbove ? y - tooltipElHeight - gap : y + gap;
  return { left: `${left}px`, top: `${top}px` };
});

const isHoveringValidMoveUpTarget = computed(() => {
  if (!moveUpState.value.active || !hoveredCourseId.value) return false;
  return moveUpState.value.validTargets.includes(hoveredCourseId.value);
});

const tooltipThemeClass = computed(() => {
  const baseClasses = 'font-normal shadow-xl max-w-[280px] rounded-md px-2 py-1 text-[11px]';
  if (activeTooltip.value.theme === 'move-up') {
    if(isHoveringValidMoveUpTarget.value) {
      return `${baseClasses} bg-[#FF9500] text-white border border-[#FF9500] dark:bg-[#FF9F0A]`;
    } else {
      return `${baseClasses} bg-white text-[#FF9500] border border-[#FF9500] dark:bg-[#1c1c1e] dark:text-[#FF9F0A] dark:border-[#FF9F0A]`;
    }
  }
  return isDarkMode.value ? `${baseClasses} bg-[#2C2C2E]/95 text-white border border-white/10 shadow-2xl` : `${baseClasses} bg-white/95 text-gray-900 border border-black/10 shadow-xl`;
});

const formatRating = (val: number | undefined) => { if (val === undefined) return '0.00'; return val.toFixed(2); };

const getCardStyles = (courseId: string): string => {
  const baseStyle = '';
  if (moveUpState.value.active) {
    if (courseId === moveUpState.value.sourceId) return baseStyle + 'bg-[#FF3B30]/10 border border-[#FF3B30] text-[#FF3B30] dark:bg-[#FF453A]/20 dark:text-[#FF453A] cursor-pointer';
    if (moveUpState.value.validTargets.includes(courseId)) return baseStyle + 'bg-[#FF9500]/10 border border-dashed border-[#FF9500] text-[#FF9500] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A] cursor-pointer animate-[pulse_2s_ease-in-out_infinite] hover:scale-[1.02] hover:bg-[#FF9500]/20';
    return baseStyle + 'bg-transparent border-black/5 dark:border-white/5 opacity-30 grayscale cursor-not-allowed pointer-events-none';
  }
  const vm = viewState.value[courseId];
  if (!vm || vm.status === 'locked') return baseStyle + 'bg-transparent border border-black/10 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-60';
  if (vm.isMoveUpSource) return baseStyle + 'bg-transparent border-2 border-solid border-[#FF9500] text-gray-600 dark:text-gray-300 font-medium opacity-85 hover:opacity-70 active:scale-[0.985]';
  if (vm.isMoveUpTarget) return baseStyle + 'bg-[#FF9500] border-[#FF9500] text-white shadow-sm font-medium dark:bg-[#FF9F0A] hover:brightness-95 active:scale-[0.985]';
  if (vm.status === 'selected') return baseStyle + 'bg-[#007AFF] border-[#007AFF] text-white shadow-sm hover:bg-[#006ae6] active:scale-[0.985]';
  if (vm.status === 'available') return baseStyle + 'bg-white border-black/10 dark:bg-[#2C2C2E] dark:border-white/10 text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#3A3A3C] shadow-sm active:scale-[0.985]';
  return baseStyle + 'bg-transparent border border-black/10 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-60';
};

const getSummaryStyles = (courseId: string): string => {
  const vm = viewState.value[courseId];
  if (!vm || vm.status === 'locked') return 'bg-transparent border-black/10 dark:border-white/10 text-gray-400 dark:text-gray-500 opacity-60';
  if (vm.isMoveUpSource) return 'bg-transparent border border-solid border-[#FF9500] text-gray-600 dark:text-gray-300 opacity-85';
  if (vm.isMoveUpTarget) return 'bg-[#FF9500] border-[#FF9500] text-white';
  if (vm.status === 'selected') return 'bg-[#007AFF] border-[#007AFF] text-white';
  return 'bg-white dark:bg-[#2C2C2E] border-black/10 dark:border-white/10 text-gray-800 dark:text-gray-200';
};

const getGradeEntryPoint = (dept: string, grade: string): string | null => { const bucket = getAllBucketCourses(dept, grade); const activeCourses = bucket.filter(c => { const st = viewState.value[c.id]?.status; return st === 'selected' || st === 'moveUpTarget'; }); if (!activeCourses.length) return null; const entry = activeCourses.find(c => { const sourceId = viewState.value[c.id]?.moveUpSourceId; if (!sourceId) return true; return courseMetaById.value.get(sourceId)?.grade !== grade; }); return entry ? entry.id : activeCourses[0]!.id; };
const getGradeExitPoint = (dept: string, grade: string): string | null => { const bucket = getAllBucketCourses(dept, grade); const activeCourses = bucket.filter(c => { const st = viewState.value[c.id]?.status; return st === 'selected' || st === 'moveUpTarget'; }); if (!activeCourses.length) return null; const exit = activeCourses.find(c => { if (!viewState.value[c.id]?.isMoveUpSource) return true; const targetId = viewState.value[c.id]?.moveUpTargetId; if (!targetId) return true; return courseMetaById.value.get(targetId)?.grade !== grade; }); return exit ? exit.id : activeCourses[activeCourses.length - 1]!.id; };
const getCollapsedSummary = (dept: string, grade: string) => { const id = getGradeExitPoint(dept, grade); return id ? courseMetaById.value.get(id) || null : null; };

const setDeptRowRef = (dept: string, el: Element | null) => { if (el instanceof HTMLElement) deptRowRefs.set(dept, el); else deptRowRefs.delete(dept); scheduleArrowRefresh(); };
const setCourseCardRef = (courseId: string, el: Element | null) => { if (el instanceof HTMLElement) courseCardRefs.set(courseId, el); else courseCardRefs.delete(courseId); scheduleArrowRefresh(); };
const setCollapsedSummaryRef = (dept: string, grade: string, el: Element | null) => { const key = `${dept}::${grade}`; if (el instanceof HTMLElement) collapsedSummaryRefs.set(key, el); else collapsedSummaryRefs.delete(key); scheduleArrowRefresh(); };

const getArrowAnchorEl = (id: string | null, dept: string, grade: string): HTMLElement | null => { if (!id) return null; return collapsedDepts.value.has(dept) ? collapsedSummaryRefs.get(`${dept}::${grade}`) || null : courseCardRefs.get(id) || null; };
const makeLanePath = (rowEl: HTMLElement, startEl: HTMLElement, endEl: HTMLElement) => { const rowRect = rowEl.getBoundingClientRect(); const s = startEl.getBoundingClientRect(); const e = endEl.getBoundingClientRect(); const sx = s.right - rowRect.left; const sy = (s.top + s.bottom) / 2 - rowRect.top; const ex = e.left - rowRect.left; const ey = (e.top + e.bottom) / 2 - rowRect.top; const mx = sx + (ex - sx) / 2; return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`; };
const makeMoveUpPath = (rowEl: HTMLElement, startEl: HTMLElement, endEl: HTMLElement) => { const rowRect = rowEl.getBoundingClientRect(); const s = startEl.getBoundingClientRect(); const e = endEl.getBoundingClientRect(); const isSameCol = Math.abs(s.left - e.left) < 50; if (isSameCol) { const startIsAbove = s.top < e.top; const sx = (s.left + s.right) / 2 - rowRect.left; const sy = (startIsAbove ? s.bottom : s.top) - rowRect.top; const ex = (e.left + e.right) / 2 - rowRect.left; const ey = (startIsAbove ? e.top : e.bottom) - rowRect.top; const ctrlOffsetY = (ey - sy) * 0.55; return `M ${sx},${sy} C ${sx},${sy + ctrlOffsetY} ${ex},${ey - ctrlOffsetY} ${ex},${ey}`; } else { const sx = s.right - rowRect.left; const sy = (s.top + s.bottom) / 2 - rowRect.top; const ex = e.left - rowRect.left; const ey = (e.top + e.bottom) / 2 - rowRect.top; const mx = sx + (ex - sx) / 2; return `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`; } };

const recomputeArrowPaths = () => {
  const nextPaths: Record<string, ArrowPath[]> = {}; const currentGrades = grades.value;
  visibleDepts.value.forEach(dept => {
    const rowEl = deptRowRefs.get(dept); if (!rowEl) return; const paths: ArrowPath[] = [];
    if (!collapsedDepts.value.has(dept)) {
      const explicitSources = Object.values(viewState.value).filter(v => v.isMoveUpSource && courseMetaById.value.get(v.id)?.dept === dept);
      explicitSources.forEach(vm => { if (!vm.moveUpTargetId) return; const sEl = courseCardRefs.get(vm.id); const tEl = courseCardRefs.get(vm.moveUpTargetId); if (sEl && tEl) paths.push({ key: `moveup:${vm.id}:${vm.moveUpTargetId}`, d: makeMoveUpPath(rowEl, sEl, tEl), variant: 'dashed' }); });
      for (let i = 0; i < currentGrades.length - 1; i++) {
        const outId = getGradeExitPoint(dept, currentGrades[i]!); const inId = getGradeEntryPoint(dept, currentGrades[i+1]!);
        if (outId && inId) {
          const outVm = viewState.value[outId]; if (outVm?.isMoveUpSource && outVm.moveUpTargetId === inId) continue;
          const startEl = getArrowAnchorEl(outId, dept, currentGrades[i]!); const endEl = getArrowAnchorEl(inId, dept, currentGrades[i+1]!);
          if (startEl && endEl) paths.push({ key: `lane:${dept}:${currentGrades[i]}:${currentGrades[i+1]}`, d: makeLanePath(rowEl, startEl, endEl), variant: 'solid' });
        }
      }
    } else {
      for (let i = 0; i < currentGrades.length - 1; i++) {
        const startEl = getArrowAnchorEl(getGradeExitPoint(dept, currentGrades[i]!), dept, currentGrades[i]!); const endEl = getArrowAnchorEl(getGradeEntryPoint(dept, currentGrades[i+1]!), dept, currentGrades[i+1]!);
        if (startEl && endEl) paths.push({ key: `col:${dept}:${currentGrades[i]}:${currentGrades[i+1]}`, d: makeLanePath(rowEl, startEl, endEl), variant: 'solid' });
      }
    }
    nextPaths[dept] = paths;
  });
  deptArrowPaths.value = nextPaths;
};
const scheduleArrowRefresh = () => { 
  if (isAnimatingLayout.value) return; // Prevent heavy recalculations during layout transition
  cancelAnimationFrame(arrowFrame); 
  arrowFrame = window.requestAnimationFrame(() => nextTick(recomputeArrowPaths)); 
};

watch(viewState, scheduleArrowRefresh, { deep: true, immediate: true });
watch([visibleDepts, collapsedDepts, grades], scheduleArrowRefresh, { deep: true });

onMounted(async () => {
  inject();
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  isDarkMode.value = prefersDark; document.documentElement.classList.toggle('dark', prefersDark);
  window.addEventListener('keydown', handleEscape); 
  window.addEventListener('click', closeDropdown);
  window.addEventListener('resize', scheduleArrowRefresh);
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(scheduleArrowRefresh);
  try {
    const data = await (new Updater()).initialize();
    if (data) {
      catalogData.value = data; controller.value = new CourseSelectionController(data); controller.value.connectView(v => viewState.value = v);
      await nextTick();
      setupScrollSync(selectedDept.value === null);
      scheduleArrowRefresh();
    }
  } catch (e) { console.error(e); }
});
onBeforeUnmount(() => { 
  cancelAnimationFrame(arrowFrame); 
  if (animationTimeout) clearTimeout(animationTimeout);
  resizeObserver?.disconnect(); 
  window.removeEventListener('keydown', handleEscape); 
  window.removeEventListener('click', closeDropdown);
  window.removeEventListener('resize', scheduleArrowRefresh); 
});
</script>

<style scoped>
.tooltip-pop-enter-active, .tooltip-pop-leave-active { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
.tooltip-pop-enter-from, .tooltip-pop-leave-to { opacity: 0; transform: scale(0.95); }
.animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

/* Dynamic Layout Logic */
.no-transition { transition: none !important; }

/* Elegant hidden scrollbar wrapper class */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
