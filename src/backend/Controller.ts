// Controller.ts
// written by willuhd on Apr 6
// - the intended public API the frontend calls in order to delegate view events
// - this updates the view data so the UI can be updated

import { CatalogSolver, type CourseAvailabilityState } from "./Solver";
import type { CourseModel } from "./CourseModel";
import type { CourseStatus, CourseViewModel } from "./ViewModel";

export class CourseSelectionController {
    private solver: CatalogSolver;
    private selectedIds: Set<string> = new Set();
    
    // Maps a base source course to its explicitly selected move-up target
    private moveUps: Map<string, string> = new Map();
    
    private onUpdate: (viewModels: Record<string, CourseViewModel>) => void = () => { };

    constructor(catalog: CourseModel) {
        this.solver = new CatalogSolver(catalog);

        this.solver.subscribe((internalState: Record<string, CourseAvailabilityState>) => {
            const uiState: Record<string, CourseViewModel> = {};

            this.solver.courseMap.forEach((course, id) => {
                const solverState = internalState[id];
                if (!solverState) return;

                const isSelected = this.selectedIds.has(id);
                const isMoveUpSource = this.moveUps.has(id);
                const explicitTargetId = this.moveUps.get(id);

                let isMoveUpTarget = false;
                let moveUpSourceId: string | undefined;
                
                for (const [source, target] of this.moveUps.entries()) {
                    if (target === id) {
                        isMoveUpTarget = true;
                        moveUpSourceId = source;
                        break;
                    }
                }

                // Discover if this source is structurally locked from being cancelled due to downstream dependency
                let isLockedMoveUpSource = false;
                if (isMoveUpSource) {
                    const testMoveUps = new Map(this.moveUps);
                    testMoveUps.delete(id); 
                    const res = this.solver.simulatePlanValidity(this.selectedIds, testMoveUps);
                    if (!res.ok) {
                        isLockedMoveUpSource = true;
                    }
                }

                let validMoveUpTargets: string[] = [];
                let invalidMoveUpTargets: Record<string, string> = {};
                let moveUpAvailable = false;

                if (course.moveUpTargetId) {
                    moveUpAvailable = true;
                    if (isSelected && !isMoveUpSource) {
                        let currentTarget: string | undefined = course.moveUpTargetId;
                        while (currentTarget) {
                            const testMoveUps = new Map(this.moveUps);
                            testMoveUps.set(id, currentTarget);
                            const validRes = this.solver.simulatePlanValidity(this.selectedIds, testMoveUps, currentTarget);
                            if (validRes.ok) {
                                validMoveUpTargets.push(currentTarget);
                            } else {
                                invalidMoveUpTargets[currentTarget] = validRes.reason || "Current configuration does not allow move-up to this course";
                            }
                            currentTarget = this.solver.courseMap.get(currentTarget)?.moveUpTargetId;
                        }
                    }
                }

                let status: CourseStatus = "locked";
                if (isMoveUpTarget) status = "moveUpTarget";
                else if (isSelected) status = "selected";
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
                    isInvalidSelection: false,
                    isMoveUpSource,
                    isMoveUpTarget,
                    isLockedMoveUpSource,
                    moveUpSourceId,
                    moveUpTargetId: explicitTargetId, 
                    moveUpAvailable,
                    validMoveUpTargets,
                    invalidMoveUpTargets,
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
        let isTarget = false;
        for (const target of this.moveUps.values()) {
            if (target === courseId) {
                isTarget = true;
                break;
            }
        }
        
        // Target cancellations are now handled via dedicated path in Frontend bridging to removeExplicitMoveUp
        if (isTarget) return; 

        if (this.selectedIds.has(courseId)) {
            this.selectedIds.delete(courseId);
            this.moveUps.delete(courseId);
            this.pruneBrokenSelections();
        } else if (this.solver.isCourseAvailable(courseId)) {
            this.clearConflictingSelection(courseId);
            this.selectedIds.add(courseId);
        }

        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    public setExplicitMoveUp(sourceId: string, targetId: string) {
        if (!this.selectedIds.has(sourceId)) return;
        this.moveUps.set(sourceId, targetId);
        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    public removeExplicitMoveUp(sourceId: string) {
        this.moveUps.delete(sourceId);
        this.pruneBrokenSelections(); // Reverting a moveup might cascade and break downstream courses 
        this.solver.setSelected(this.selectedIds, this.moveUps);
    }

    private pruneBrokenSelections() {
        let changed = false;
        let iterations = 0;

        do {
            changed = false;
            iterations++;
            
            // Re-simulate the current projected plan in order to find broken branches iteratively
            const res = this.solver.simulatePlanValidity(this.selectedIds, this.moveUps);
            
            if (!res.ok && res.failure) {
                const culprit = res.failure.sourceCourseId;
                
                if (culprit && this.selectedIds.has(culprit)) {
                    // Exact culprit is found locally in our selections
                    this.selectedIds.delete(culprit);
                    this.moveUps.delete(culprit);
                    changed = true;
                } else if (culprit) {
                    // Safety mapping in case the culprit was evaluating off of a move-up target identity
                    let found = false;
                    for (const [src, tgt] of this.moveUps.entries()) {
                        if (tgt === culprit || src === culprit) {
                            this.selectedIds.delete(src);
                            this.moveUps.delete(src);
                            changed = true;
                            found = true;
                            break;
                        }
                    }
                    if (!found) break; // Infinite loop fail-safe exit
                } else {
                    break; 
                }
            }
        } while (changed && iterations < 50);
    }

    private clearConflictingSelection(courseId: string) {
        const courseGroup = this.solver.getConflictGroupId(courseId);
        if (!courseGroup) return;

        for (const s of [...this.selectedIds]) {
            if (s === courseId) continue;
            const t = this.moveUps.get(s) || s;
            
            if (this.solver.getConflictGroupId(t) === courseGroup || this.solver.getConflictGroupId(s) === courseGroup) {
                this.selectedIds.delete(s);
                this.moveUps.delete(s);
            }
        }
    }
}
