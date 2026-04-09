// Controller.ts

import { CatalogSolver, type CourseAvailabilityState } from "./Solver";
import type { CourseModel } from "./CourseModel";
import type { CourseStatus, CourseViewModel } from "./ViewModel";

export class CourseSelectionController {
    private solver: CatalogSolver;
    private selectedIds: Set<string> = new Set();
    private activeMoveUps: Set<string> = new Set();
    private onUpdate: (viewModels: Record<string, CourseViewModel>) => void = () => { };

    constructor(catalog: CourseModel) {
        this.solver = new CatalogSolver(catalog);

        this.solver.subscribe((internalState: Record<string, CourseAvailabilityState>) => {
            const uiState: Record<string, CourseViewModel> = {};
            const moveUpPreviewSources = this.buildPreviewSourceMap();

            const lineageMemo = new Map<string, string[]>();
            const buildLineage = (courseId: string): string[] => {
                const cached = lineageMemo.get(courseId);
                if (cached) return cached;

                const sourceId = moveUpPreviewSources.get(courseId);
                if (!sourceId) {
                    lineageMemo.set(courseId, []);
                    return [];
                }

                const parentLineage = buildLineage(sourceId);
                const lineage = [...parentLineage, sourceId];
                lineageMemo.set(courseId, lineage);
                return lineage;
            };

            this.solver.courseMap.forEach((course, id) => {
                const solverState = internalState[id];
                if (!solverState) return;

                const isSelected = this.selectedIds.has(id);
                const isMoveUpSource = this.activeMoveUps.has(id);
                const moveUpSourceId = moveUpPreviewSources.get(id);
                const isMoveUpPreview = Boolean(moveUpSourceId);
                const isInvalidSelection = isSelected && !isMoveUpSource && !solverState.isAvailable;
                const moveUpTargetId = course.moveUpTargetId;
                const moveUpLineageIds = moveUpTargetId && (isSelected || isMoveUpPreview || isMoveUpSource)
                    ? buildLineage(id)
                    : undefined;
                const moveUpAvailable = Boolean(moveUpTargetId && this.solver.canBypassCourse(id));

                let status: CourseStatus = "locked";
                if (isMoveUpPreview) status = "moveUpPreview";
                else if (isSelected && !isInvalidSelection) status = "selected";
                else if (solverState.isAvailable) status = "available";

                let lockReason = undefined;
                if (status === "locked") {
                    if (solverState.conflictReason) {
                        lockReason = solverState.conflictReason;
                    } else {
                        const reasons = [];
                        if (solverState.missingPre.length > 0) {
                            reasons.push(`Requires: ${solverState.missingPre.map(b => b.map(reqId => this.solver.courseMap.get(reqId)?.name || reqId).join(" or ")).join(" AND ")}`);
                        }
                        if (solverState.missingCurrent.length > 0) {
                            reasons.push(`Concurrent: ${solverState.missingCurrent.map(b => b.map(reqId => this.solver.courseMap.get(reqId)?.name || reqId).join(" or ")).join(" AND ")}`);
                        }
                        if (reasons.length > 0) lockReason = reasons.join(" | ");
                    }
                }

                uiState[id] = {
                    id: course.id,
                    name: course.name || course.id,
                    grade: course.grade || "N/A",
                    status,
                    isSelected,
                    isInvalidSelection,
                    isMoveUpSource,
                    moveUpSourceId,
                    moveUpTargetId,
                    moveUpLineageIds,
                    moveUpAvailable,
                    lockReason,
                    moveUpNote: course.moveUp,
                    crowdRating: Math.round(course.crowdRating || 0),
                };
            });

            this.onUpdate(uiState);
        });
    }

    public connectView(callback: (viewModels: Record<string, CourseViewModel>) => void) {
        this.onUpdate = callback;
        this.solver.forceNotify();
    }

    public handleTap(courseId: string) {
        if (this.selectedIds.has(courseId)) {
            this.selectedIds.delete(courseId);
            this.activeMoveUps.delete(courseId);
        } else if (this.solver.isCourseAvailable(courseId)) {
            this.clearConflictingSelection(courseId);
            this.selectedIds.add(courseId);
        }

        this.solver.setSelected(this.selectedIds, this.activeMoveUps);
    }

    public handleMoveUpTap(courseId: string) {
        const course = this.solver.courseMap.get(courseId);
        if (!course?.moveUpTargetId) return;

        if (!this.activeMoveUps.has(courseId)) {
            const lineageDepth = this.buildLineage(courseId, this.buildPreviewSourceMap()).length;
            if (lineageDepth >= 3) return;
        }

        if (!this.selectedIds.has(courseId)) {
            this.clearConflictingSelection(courseId);
            this.selectedIds.add(courseId);
        }

        if (this.activeMoveUps.has(courseId)) {
            this.activeMoveUps.delete(courseId);
            this.pruneBrokenSelections();
        } else {
            this.activeMoveUps.add(courseId);
        }

        this.solver.setSelected(this.selectedIds, this.activeMoveUps);
    }

    private buildPreviewSourceMap() {
        const moveUpPreviewSources = new Map<string, string>();

        for (const sourceId of this.activeMoveUps) {
            const targetId = this.solver.getMoveUpTargetId(sourceId);
            if (targetId) moveUpPreviewSources.set(targetId, sourceId);
        }

        return moveUpPreviewSources;
    }

    private buildLineage(courseId: string, moveUpPreviewSources: Map<string, string>): string[] {
        const sourceId = moveUpPreviewSources.get(courseId);
        if (!sourceId) return [];

        return [...this.buildLineage(sourceId, moveUpPreviewSources), sourceId];
    }

    private pruneBrokenSelections() {
        let changed = false;

        do {
            changed = false;

            for (const selectedId of [...this.selectedIds]) {
                if (this.activeMoveUps.has(selectedId)) continue;
                if (this.solver.isCourseAvailable(selectedId)) continue;

                this.selectedIds.delete(selectedId);
                this.activeMoveUps.delete(selectedId);
                changed = true;
            }
        } while (changed);

        for (const sourceId of [...this.activeMoveUps]) {
            if (!this.selectedIds.has(sourceId) || !this.solver.getMoveUpTargetId(sourceId)) {
                this.activeMoveUps.delete(sourceId);
            }
        }
    }

    private clearConflictingSelection(courseId: string) {
        const targetGroupId = this.solver.getConflictGroupId(courseId);
        if (!targetGroupId) return;

        for (const selectedId of [...this.selectedIds]) {
            if (selectedId === courseId) continue;
            if (this.solver.getConflictGroupId(selectedId) !== targetGroupId) continue;

            this.selectedIds.delete(selectedId);
            this.activeMoveUps.delete(selectedId);
        }
    }
}
