export type SessionMode = "demo" | "production";
export type UserRole = "sv" | "store";
export type AuditStepStatus = "draft" | "saved" | "completed" | "blocked";
export type AuditItemStatus = "ok" | "ng";
export type TaskStatus = "open" | "submitted" | "resolved" | "overdue";
export type TaskCategory = "minimum" | "operation" | "value";
export type TaskConfirmationStatus = "pending" | "approved";

export interface SessionUser {
  id: string;
  role: UserRole;
  mode: SessionMode;
  name: string;
  storeId?: string;
  storeName?: string;
  svCode?: string;
  larkOpenId?: string;
  larkUserId?: string;
}

export interface Store {
  id: string;
  name: string;
  region: string;
  block: string;
  format?: string;
  group?: string;
  svName: string;
  svCode: string;
  manager?: string;
  officer?: string;
  latestAuditDate?: string;
  latestOperationScore?: number;
  latestValueScore?: number;
  latestTotalScore?: number;
  previousTotalScore?: number;
  currentRank?: number;
  previousRank?: number;
  hygieneCurrentScore?: number;
  hygienePreviousScore?: number;
}

export interface ChecklistDefinition {
  key: string;
  label: string;
  group: string;
  maxScore: number;
  larkFieldId?: string;
  larkFieldName?: string;
  description?: string;
}

export interface AuditChecklistItem extends ChecklistDefinition {
  status: AuditItemStatus;
  note?: string;
}

export interface OperationAudit {
  id: string;
  storeId: string;
  storeName: string;
  auditDate: string;
  score: number;
  grade: string;
  completionState: AuditStepStatus;
  isPerfect: boolean;
  items: AuditChecklistItem[];
}

export interface ValueAudit {
  id: string;
  storeId: string;
  storeName: string;
  auditDate: string;
  score: number;
  grade: string;
  completionState: AuditStepStatus;
  items: AuditChecklistItem[];
}

export interface FiveCResult {
  id: string;
  storeId: string;
  storeName: string;
  auditDate: string;
  cycle: "Q1" | "Q2" | "Q3" | "Q4";
  minimumScore: number;
  minimumGrade: string;
  operationScore: number;
  valueScore: number;
  totalScore: number;
  stage:
    | "minimum_in_progress"
    | "minimum_failed"
    | "minimum_passed"
    | "operation_in_progress"
    | "completed";
  createdBy: string;
  minimumAuditId: string;
  operationAuditId: string;
  valueAuditId?: string;
}

export interface UploadedPhoto {
  name: string;
  url: string;
  fileToken?: string;
}

export interface RectificationFeedback {
  id: string;
  taskId: string;
  comment: string;
  photos: UploadedPhoto[];
  submittedAt: string;
  submittedBy: string;
}

export interface RectificationTask {
  id: string;
  storeId: string;
  storeName: string;
  auditDate: string;
  category: TaskCategory;
  sourceItemKey: string;
  issueType: string;
  comment: string;
  improvementPlan: string;
  dueDate: string;
  assignee: string;
  svName: string;
  status: TaskStatus;
  confirmationStatus: TaskConfirmationStatus;
  beforePhotos: UploadedPhoto[];
  afterPhotos: UploadedPhoto[];
  feedbackComment?: string;
  feedbackSubmittedAt?: string;
  linkedOperationAuditId?: string;
  linkedValueAuditId?: string;
  linkedResultId?: string;
  history: RectificationFeedback[];
}

export interface DashboardSummary {
  pendingTasks: number;
  dueSoonTasks: number;
  overdueTasks: number;
  submittedTasks: number;
}

export interface SvDashboardData {
  stores: Store[];
  recentResults: FiveCResult[];
  tasks: RectificationTask[];
  summary: DashboardSummary;
}

export interface StoreWorkbenchData {
  store: Store;
  latestResult?: FiveCResult;
  history: FiveCResult[];
  openTasks: RectificationTask[];
}

export interface AuditDraftItemInput {
  key: string;
  label: string;
  group: string;
  maxScore: number;
  status: AuditItemStatus;
  note?: string;
}

export interface CreateTaskInput {
  category: TaskCategory;
  sourceItemKey: string;
  issueType: string;
  comment: string;
  improvementPlan: string;
  dueDate: string;
  assignee: string;
  beforePhotos?: UploadedPhoto[];
}

export interface CreateAuditInput {
  storeId: string;
  cycle: "Q1" | "Q2" | "Q3" | "Q4";
  auditDate: string;
  evaluator: string;
  minimumItems: AuditDraftItemInput[];
  operationItems: AuditDraftItemInput[];
  valueItems: AuditDraftItemInput[];
  minimumCompletionState: AuditStepStatus;
  operationCompletionState: AuditStepStatus;
  valueCompletionState: AuditStepStatus;
  tasks: CreateTaskInput[];
}

export interface SubmitFeedbackInput {
  comment: string;
  photos: UploadedPhoto[];
}

export interface TaskQuery {
  storeId?: string;
  status?: TaskStatus | "all";
  search?: string;
}

export interface FieldSchema {
  fieldId: string;
  fieldName: string;
  type: string;
  property?: Record<string, unknown>;
}

export interface TableSchema {
  tableId: string;
  tableName: string;
  fields: FieldSchema[];
}

export interface DashboardFilters {
  cycle?: "Q1" | "Q2" | "Q3" | "Q4" | "all";
  format?: string;
  group?: string;
  sv?: string;
  manager?: string;
  grade?: string;
}

export interface DashboardKpi {
  totalStores: number;
  evaluatedStores: number;
  minimumPassRate: number;
  minimumFailedStores: number;
  operationCompletionRate: number;
  rectificationOpenCount: number;
  overdueRectificationCount: number;
}

export interface DashboardGradePoint {
  label: string;
  value: number;
}

export interface DashboardIssuePoint {
  issueKey: string;
  value: number;
}

export interface DashboardRankingEntry {
  storeId: string;
  storeName: string;
  format: string;
  group: string;
  score: number;
  previousScore: number;
  minimumPassed: boolean;
}

export interface DashboardTrendPoint {
  label: string;
  previous: number;
  current: number;
}

export interface DashboardHygienePoint {
  storeId: string;
  storeName: string;
  score: number;
}

export interface DashboardIssueRecord {
  id: string;
  storeId: string;
  storeName: string;
  issueType: string;
  category: TaskCategory;
  dueDate: string;
  status: TaskStatus;
}

export interface HygieneInspection {
  id: string;
  storeId: string;
  storeName: string;
  period: string;
  score: number;
}

export interface DashboardOverviewData {
  filters: DashboardFilters;
  kpis: DashboardKpi;
  availableFormats: string[];
  availableGroups: string[];
  availableManagers: string[];
  availableSvs: string[];
  gradeComposition: DashboardGradePoint[];
  formatGradeComposition: Record<string, DashboardGradePoint[]>;
  top10: DashboardRankingEntry[];
  worst10: DashboardRankingEntry[];
  topIssues: DashboardIssuePoint[];
  formatTrends: DashboardTrendPoint[];
  improvementProgress: DashboardRankingEntry[];
  hygieneNeedsImprovement: DashboardHygienePoint[];
  minimumFailureReasons: DashboardIssuePoint[];
  minimumFailedStores: DashboardRankingEntry[];
  issueRecords: DashboardIssueRecord[];
}

export interface StoreDashboardData {
  store: Store;
  cycle: "Q1" | "Q2" | "Q3" | "Q4" | "all";
  currentResult?: FiveCResult;
  previousResult?: FiveCResult;
  currentRank: number | null;
  previousRank: number | null;
  rankDelta: number | null;
  scoreDelta: number;
  minimumStatusLabel: string;
  minimumItems: AuditChecklistItem[];
  operationItems: AuditChecklistItem[];
  valueItems: AuditChecklistItem[];
  openTasks: RectificationTask[];
  overdueTasks: RectificationTask[];
  resolvedTasks: RectificationTask[];
}
