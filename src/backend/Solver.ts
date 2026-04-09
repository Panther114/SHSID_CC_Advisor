// Solver.ts
// rewritten to use an explicit dependency/conflict graph

import type { CourseModel, CourseNode } from "./CourseModel";

type RuleKind = "pre" | "current";

interface RequirementNode {
    id: string;
    courseId: string;
    kind: RuleKind;
    options: string[];
}

interface GraphCourseNode extends CourseNode {
    grade: string;
    department: string;
    conflictGroupId?: string;
    requirements: RequirementNode[];
    continuationTargets: string[];
}

interface ResolutionContext {
    closure: Set<string>;
    occupancy: Map<string, string>;
    resolved: Set<string>;
}

interface ResolutionFailure {
    type: "group_conflict" | "missing_reference" | "cycle" | "dead_end" | "track_lock";
    sourceCourseId: string;
    requirement?: RequirementNode;
    targetCourseId?: string;
    blockerCourseId?: string;
    continuationTargets?: string[];
    path?: string[];
    causes?: ResolutionFailure[];
}

interface ResolutionResult {
    ok: boolean;
    context: ResolutionContext;
    failure?: ResolutionFailure;
}

interface PlanResolution {
    ok: boolean;
    closure: Set<string>;
    failure?: ResolutionFailure;
}

interface EffectiveSelectionState {
    selection: Set<string>;
    overrides: Set<string>;
    sourceToTarget: Map<string, string>;
    targetToSource: Map<string, string>;
}

export interface MoveUpOpportunity {
    sourceCourseId: string;
    targetCourseId: string;
    note?: string;
}

export interface CourseAvailabilityState {
    isAvailable: boolean;
    missingPre: string[][];
    missingCurrent: string[][];
    moveUpOpportunity?: MoveUpOpportunity;
    conflictReason?: string;
}

export class CatalogSolver {
    private catalog: CourseModel;
    public courseMap: Map<string, GraphCourseNode> = new Map();
    private conflictGroups: Map<string, Set<string>> = new Map();

    private selectedCourses: Set<string> = new Set();
    private activeMoveUps: Set<string> = new Set();
    private evaluationCache: Map<string, CourseAvailabilityState> = new Map();

    private subscribers: Array<(state: Record<string, CourseAvailabilityState>) => void> = [];

    constructor(catalog: CourseModel) {
        this.catalog = catalog;
        this.buildGraph();
    }

    private buildGraph() {
        const depts = this.catalog.departments || {};

        for (const [deptName, deptData] of Object.entries(depts)) {
            if (deptName === "residuals" && Array.isArray(deptData)) {
                deptData.forEach(course => {
                    this.addCourseNode(course, {
                        department: deptName,
                        grade: "Residual"
                    });
                });
                continue;
            }

            if (typeof deptData !== "object" || deptData === null || Array.isArray(deptData)) {
                continue;
            }

            for (const [grade, courses] of Object.entries(deptData)) {
                if (!Array.isArray(courses)) continue;

                const conflictGroupId = `${deptName}::${grade}`;
                const group = this.conflictGroups.get(conflictGroupId) ?? new Set<string>();

                courses.forEach(course => {
                    this.addCourseNode(course, {
                        department: deptName,
                        grade,
                        conflictGroupId
                    });
                    group.add(course.id);
                });

                this.conflictGroups.set(conflictGroupId, group);
            }
        }
    }

    private addCourseNode(
        course: CourseNode,
        meta: { department: string; grade: string; conflictGroupId?: string }
    ) {
        const requirements: RequirementNode[] = [];
        const continuationTargets = new Set<string>();

        (["pre", "current"] as const).forEach(kind => {
            course.rules?.[kind]?.forEach((options, index) => {
                const sanitizedOptions = options.filter(Boolean);
                if (sanitizedOptions.length === 0) return;

                requirements.push({
                    id: `${course.id}:${kind}:${index}`,
                    courseId: course.id,
                    kind,
                    options: sanitizedOptions
                });
            });
        });

        course.rules?.next?.forEach(options => {
            options.filter(Boolean).forEach(targetId => continuationTargets.add(targetId));
        });

        this.courseMap.set(course.id, {
            ...course,
            ...meta,
            requirements,
            continuationTargets: [...continuationTargets]
        });
    }

    public subscribe(callback: (state: Record<string, CourseAvailabilityState>) => void): () => void {
        this.subscribers.push(callback);
        callback(this.evaluateGraph());
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    public forceNotify() {
        this.evaluationCache.clear();
        const state = this.evaluateGraph();
        this.subscribers.forEach(cb => cb(state));
    }

    public setSelected(selected: Set<string>, activeMoveUps: Set<string>) {
        this.selectedCourses = new Set(selected);
        this.activeMoveUps = new Set(activeMoveUps);
        this.forceNotify();
    }

    public isCourseAvailable(courseId: string): boolean {
        return this.evaluateCourseAvailability(courseId).isAvailable;
    }

    public getMoveUpOpportunity(courseId: string): MoveUpOpportunity | undefined {
        return this.evaluateCourseAvailability(courseId).moveUpOpportunity;
    }

    public getMoveUpTargetId(courseId: string): string | undefined {
        return this.courseMap.get(courseId)?.moveUpTargetId;
    }

    public canBypassCourse(courseId: string): boolean {
        const course = this.courseMap.get(courseId);
        if (!course?.moveUpTargetId) return false;

        const selected = new Set(this.selectedCourses);
        selected.add(courseId);
        const activeMoveUps = new Set(this.activeMoveUps);
        activeMoveUps.add(courseId);

        const effectiveState = this.buildEffectiveSelectionState(selected, activeMoveUps);
        const projectedPlan = this.projectSelectionForCourse(courseId, effectiveState);
        return this.resolveSelection(projectedPlan.selection, projectedPlan.overrides).ok;
    }

    public evaluateGraph(): Record<string, CourseAvailabilityState> {
        const state: Record<string, CourseAvailabilityState> = {};

        this.courseMap.forEach((_, id) => {
            state[id] = this.evaluateCourseAvailability(id);
        });

        return state;
    }

    private evaluateCourseAvailability(courseId: string): CourseAvailabilityState {
        const cacheKey = this.makeCacheKey(courseId);
        const cached = this.evaluationCache.get(cacheKey);
        if (cached) return cached;

        const course = this.courseMap.get(courseId);
        if (!course) {
            const missingState: CourseAvailabilityState = {
                isAvailable: false,
                missingPre: [],
                missingCurrent: [],
                conflictReason: `Course ${courseId} is missing from the catalog graph.`
            };

            this.evaluationCache.set(cacheKey, missingState);
            return missingState;
        }

        const effectiveState = this.buildEffectiveSelectionState(this.selectedCourses, this.activeMoveUps);
        const projectedPlan = this.projectSelectionForCourse(courseId, effectiveState);
        const resolution = this.resolveSelection(projectedPlan.selection, projectedPlan.overrides);
        const activeMoveUpOpportunity = this.findActiveMoveUpOpportunity(courseId);
        const result: CourseAvailabilityState = {
            isAvailable: resolution.ok,
            missingPre: this.getMissingRequirements(course.rules?.pre, effectiveState.selection),
            missingCurrent: this.getMissingRequirements(course.rules?.current, effectiveState.selection),
            conflictReason: resolution.ok ? undefined : this.describeFailure(resolution.failure, courseId),
            moveUpOpportunity: activeMoveUpOpportunity || (resolution.ok || effectiveState.selection.has(courseId)
                ? undefined
                : this.findMoveUpOpportunity(courseId))
        };

        this.evaluationCache.set(cacheKey, result);
        return result;
    }

    private buildEffectiveSelectionState(
        selected: Set<string>,
        activeMoveUps: Set<string>
    ): EffectiveSelectionState {
        const selection = new Set<string>();
        const overrides = new Set<string>();
        const sourceToTarget = new Map<string, string>();
        const targetToSource = new Map<string, string>();

        for (const selectedId of selected) {
            const course = this.courseMap.get(selectedId);
            const targetId = activeMoveUps.has(selectedId) ? course?.moveUpTargetId : undefined;

            if (targetId && this.courseMap.has(targetId)) {
                selection.add(targetId);
                overrides.add(targetId);
                sourceToTarget.set(selectedId, targetId);
                targetToSource.set(targetId, selectedId);
                continue;
            }

            selection.add(selectedId);
        }

        return {
            selection,
            overrides,
            sourceToTarget,
            targetToSource
        };
    }

    private findMoveUpOpportunity(courseId: string): MoveUpOpportunity | undefined {
        for (const selectedId of this.selectedCourses) {
            if (this.activeMoveUps.has(selectedId)) continue;

            const sourceCourse = this.courseMap.get(selectedId);
            const targetCourseId = sourceCourse?.moveUpTargetId;
            if (!sourceCourse?.moveUp || !targetCourseId || !this.courseMap.has(targetCourseId)) continue;

            const projectedMoveUps = new Set(this.activeMoveUps);
            projectedMoveUps.add(selectedId);

            const effectiveState = this.buildEffectiveSelectionState(this.selectedCourses, projectedMoveUps);
            const projectedPlan = this.projectSelectionForCourse(courseId, effectiveState);
            const resolution = this.resolveSelection(projectedPlan.selection, projectedPlan.overrides);

            if (resolution.ok) {
                return {
                    sourceCourseId: selectedId,
                    targetCourseId,
                    note: sourceCourse.moveUp
                };
            }
        }

        return undefined;
    }

    private findActiveMoveUpOpportunity(courseId: string): MoveUpOpportunity | undefined {
        if (this.activeMoveUps.size === 0) return undefined;

        for (const sourceId of this.activeMoveUps) {
            const sourceCourse = this.courseMap.get(sourceId);
            const targetCourseId = sourceCourse?.moveUpTargetId;
            if (!sourceCourse?.moveUp || !targetCourseId || !this.courseMap.has(targetCourseId)) continue;

            const projectedMoveUps = new Set(this.activeMoveUps);
            projectedMoveUps.delete(sourceId);

            const effectiveState = this.buildEffectiveSelectionState(this.selectedCourses, projectedMoveUps);
            const projectedPlan = this.projectSelectionForCourse(courseId, effectiveState);
            const resolution = this.resolveSelection(projectedPlan.selection, projectedPlan.overrides);

            if (!resolution.ok) {
                return {
                    sourceCourseId: sourceId,
                    targetCourseId,
                    note: sourceCourse.moveUp
                };
            }
        }

        return undefined;
    }

    private resolveSelection(targetSelection: Set<string>, overrides: Set<string>): PlanResolution {
        const baseContext = this.createBaseContext(targetSelection);
        if (!baseContext.ok) {
            return {
                ok: false,
                closure: new Set(targetSelection),
                failure: baseContext.failure
            };
        }

        let context = baseContext.context;
        for (const courseId of targetSelection) {
            const result = this.resolveCourse(courseId, context, [], overrides);
            if (!result.ok) {
                return {
                    ok: false,
                    closure: result.context.closure,
                    failure: result.failure
                };
            }

            context = result.context;
        }

        const continuationFailure = this.findContinuationConflict(context.closure);
        if (continuationFailure) {
            return {
                ok: false,
                closure: context.closure,
                failure: continuationFailure
            };
        }

        return {
            ok: true,
            closure: context.closure
        };
    }

    private createBaseContext(targetSelection: Set<string>): ResolutionResult {
        const context: ResolutionContext = {
            closure: new Set(targetSelection),
            occupancy: new Map<string, string>(),
            resolved: new Set<string>()
        };

        for (const courseId of targetSelection) {
            const course = this.courseMap.get(courseId);
            if (!course) {
                return {
                    ok: false,
                    context,
                    failure: {
                        type: "missing_reference",
                        sourceCourseId: courseId,
                        targetCourseId: courseId
                    }
                };
            }

            if (!course.conflictGroupId) continue;

            const occupiedBy = context.occupancy.get(course.conflictGroupId);
            if (occupiedBy && occupiedBy !== courseId) {
                return {
                    ok: false,
                    context,
                    failure: {
                        type: "group_conflict",
                        sourceCourseId: courseId,
                        targetCourseId: courseId,
                        blockerCourseId: occupiedBy
                    }
                };
            }

            context.occupancy.set(course.conflictGroupId, courseId);
        }

        return {
            ok: true,
            context
        };
    }

    private findContinuationConflict(closure: Set<string>): ResolutionFailure | undefined {
        for (const sourceCourseId of closure) {
            const sourceCourse = this.courseMap.get(sourceCourseId);
            if (!sourceCourse || sourceCourse.continuationTargets.length === 0) continue;

            const nextGrade = this.getNextGrade(sourceCourse.grade);
            if (!nextGrade) continue;

            const groupId = `${sourceCourse.department}::${nextGrade}`;
            const nextGradeGroup = this.conflictGroups.get(groupId);
            if (!nextGradeGroup) continue;

            const allowedTargets = new Set(sourceCourse.continuationTargets);
            for (const targetCourseId of nextGradeGroup) {
                if (targetCourseId === sourceCourseId) continue;
                if (allowedTargets.has(targetCourseId)) continue;
                if (!closure.has(targetCourseId)) continue;

                return {
                    type: "track_lock",
                    sourceCourseId,
                    targetCourseId,
                    blockerCourseId: sourceCourseId,
                    continuationTargets: [...allowedTargets]
                };
            }
        }

        return undefined;
    }

    private resolveCourse(
        courseId: string,
        context: ResolutionContext,
        path: string[],
        overrides: Set<string>
    ): ResolutionResult {
        const course = this.courseMap.get(courseId);
        if (!course) {
            return {
                ok: false,
                context,
                failure: {
                    type: "missing_reference",
                    sourceCourseId: path[path.length - 1] || courseId,
                    targetCourseId: courseId,
                    path: [...path, courseId]
                }
            };
        }

        if (context.resolved.has(courseId)) {
            return {
                ok: true,
                context
            };
        }

        if (path.includes(courseId)) {
            return {
                ok: false,
                context,
                failure: {
                    type: "cycle",
                    sourceCourseId: courseId,
                    path: [...path, courseId]
                }
            };
        }

        let workingContext = this.cloneContext(context);
        workingContext.closure.add(courseId);

        if (course.conflictGroupId) {
            const occupiedBy = workingContext.occupancy.get(course.conflictGroupId);
            if (occupiedBy && occupiedBy !== courseId) {
                return {
                    ok: false,
                    context,
                    failure: {
                        type: "group_conflict",
                        sourceCourseId: path[path.length - 1] || courseId,
                        targetCourseId: courseId,
                        blockerCourseId: occupiedBy,
                        path: [...path, courseId]
                    }
                };
            }

            workingContext.occupancy.set(course.conflictGroupId, courseId);
        }

        if (overrides.has(courseId)) {
            workingContext.resolved.add(courseId);
            return {
                ok: true,
                context: workingContext
            };
        }

        const nextPath = [...path, courseId];

        for (const requirement of course.requirements) {
            const requirementResult = this.resolveRequirement(requirement, workingContext, nextPath, overrides);
            if (!requirementResult.ok) {
                return requirementResult;
            }

            workingContext = requirementResult.context;
        }

        workingContext.resolved.add(courseId);
        return {
            ok: true,
            context: workingContext
        };
    }

    private resolveRequirement(
        requirement: RequirementNode,
        context: ResolutionContext,
        path: string[],
        overrides: Set<string>
    ): ResolutionResult {
        const failures: ResolutionFailure[] = [];
        const orderedOptions = this.orderRequirementOptions(requirement.options, context);

        for (const optionId of orderedOptions) {
            if (!this.courseMap.has(optionId)) {
                failures.push({
                    type: "missing_reference",
                    sourceCourseId: requirement.courseId,
                    requirement,
                    targetCourseId: optionId,
                    path: [...path, optionId]
                });
                continue;
            }

            const branchContext = this.cloneContext(context);
            const branchResult = this.resolveCourse(optionId, branchContext, path, overrides);
            if (branchResult.ok) {
                const continuationFailure = this.findContinuationConflict(branchResult.context.closure);
                if (continuationFailure) {
                    failures.push(continuationFailure);
                    continue;
                }

                return branchResult;
            }

            if (branchResult.failure) {
                failures.push(branchResult.failure);
            }
        }

        return {
            ok: false,
            context,
            failure: {
                type: "dead_end",
                sourceCourseId: requirement.courseId,
                requirement,
                path,
                causes: failures
            }
        };
    }

    private orderRequirementOptions(options: string[], context: ResolutionContext): string[] {
        return [...options].sort((left, right) => {
            const leftPriority = context.closure.has(left) ? 0 : 1;
            const rightPriority = context.closure.has(right) ? 0 : 1;
            if (leftPriority !== rightPriority) return leftPriority - rightPriority;
            return left.localeCompare(right);
        });
    }

    private describeFailure(failure: ResolutionFailure | undefined, focusCourseId: string): string | undefined {
        if (!failure) return undefined;

        switch (failure.type) {
            case "group_conflict": {
                const targetName = this.getCourseName(failure.targetCourseId || failure.sourceCourseId);
                const blockerName = this.getCourseName(failure.blockerCourseId);
                return `${targetName} conflicts with ${blockerName} in the same department-year slot.`;
            }
            case "missing_reference":
                return `Catalog rule references missing course ${failure.targetCourseId || focusCourseId}.`;
            case "cycle": {
                const cyclePath = failure.path?.map(id => this.getCourseName(id)).join(" -> ");
                return cyclePath
                    ? `Catalog rule loops through ${cyclePath}.`
                    : `Catalog rule contains a dependency cycle around ${this.getCourseName(focusCourseId)}.`;
            }
            case "dead_end": {
                const nestedReason = failure.causes
                    ?.map(cause => this.describeFailure(cause, focusCourseId))
                    .find((message): message is string => Boolean(message));

                if (nestedReason) return nestedReason;

                if (failure.requirement) {
                    const options = failure.requirement.options.map(id => this.getCourseName(id)).join(" or ");
                    const label = failure.requirement.kind === "current" ? "Concurrent path" : "Prerequisite path";
                    return `${label} cannot be satisfied through ${options}.`;
                }

                return `No valid rule path remains for ${this.getCourseName(focusCourseId)}.`;
            }
            case "track_lock": {
                const sourceName = this.getCourseName(failure.sourceCourseId);
                const blockedName = this.getCourseName(failure.targetCourseId || focusCourseId);
                const allowedNames = failure.continuationTargets
                    ?.map(id => this.getCourseName(id))
                    .join(" or ");

                if (allowedNames) {
                    return `Selecting ${sourceName} reserves ${allowedNames} for the next grade, so ${blockedName} is unavailable.`;
                }

                return `Selecting ${sourceName} locks the next-grade path, so ${blockedName} is unavailable.`;
            }
        }
    }

    private getCourseName(courseId?: string): string {
        if (!courseId) return "another course";
        return this.courseMap.get(courseId)?.name || courseId;
    }

    public getConflictGroupId(courseId: string): string | undefined {
        return this.courseMap.get(courseId)?.conflictGroupId;
    }

    private projectSelectionForCourse(
        courseId: string,
        effectiveState: EffectiveSelectionState
    ): { selection: Set<string>; overrides: Set<string> } {
        const selection = new Set(effectiveState.selection);
        const overrides = new Set(effectiveState.overrides);
        const targetGroupId = this.getConflictGroupId(courseId);

        if (targetGroupId) {
            for (const selectedId of selection) {
                if (selectedId === courseId) continue;
                if (this.getConflictGroupId(selectedId) !== targetGroupId) continue;

                selection.delete(selectedId);
                overrides.delete(selectedId);
            }
        }

        selection.add(courseId);
        return { selection, overrides };
    }

    private makeCacheKey(courseId: string): string {
        const selected = [...this.selectedCourses].sort().join("|");
        const moveUps = [...this.activeMoveUps].sort().join("|");
        return `${courseId}::${selected}::${moveUps}`;
    }

    private getNextGrade(grade: string): string | undefined {
        const parsedGrade = Number.parseInt(grade, 10);
        if (!Number.isFinite(parsedGrade)) return undefined;
        return String(parsedGrade + 1);
    }

    private cloneContext(context: ResolutionContext): ResolutionContext {
        return {
            closure: new Set(context.closure),
            occupancy: new Map(context.occupancy),
            resolved: new Set(context.resolved)
        };
    }

    private getMissingRequirements(dnf: string[][] | undefined, userState: Set<string>): string[][] {
        if (!dnf) return [];
        return dnf.filter(orBlock => !orBlock.some(id => userState.has(id)));
    }
}
