import type {
  CreateAuditInput,
  FiveCResult,
  HygieneInspection,
  OperationAudit,
  RectificationTask,
  SessionUser,
  Store,
  StoreWorkbenchData,
  SubmitFeedbackInput,
  SvDashboardData,
  TableSchema,
  TaskQuery,
  ValueAudit,
} from "../domain";

export interface BaseRepository {
  getSvDashboard(user: SessionUser): Promise<SvDashboardData>;
  getStoreWorkbench(user: SessionUser): Promise<StoreWorkbenchData>;
  listTasks(user: SessionUser, query?: TaskQuery): Promise<RectificationTask[]>;
  getTask(user: SessionUser, taskId: string): Promise<RectificationTask | null>;
  getStoresForSv(user: SessionUser): Promise<Store[]>;
  getRecentResults(user: SessionUser): Promise<FiveCResult[]>;
  getHygieneInspections(user: SessionUser): Promise<HygieneInspection[]>;
  getMinimumAudit(auditId: string): Promise<OperationAudit | null>;
  getOperationAudit(auditId: string): Promise<OperationAudit | null>;
  getValueAudit(auditId: string): Promise<ValueAudit | null>;
  createAudit(user: SessionUser, input: CreateAuditInput): Promise<FiveCResult>;
  submitTaskFeedback(
    user: SessionUser,
    taskId: string,
    input: SubmitFeedbackInput,
  ): Promise<RectificationTask>;
  markTaskResolved(user: SessionUser, taskId: string): Promise<RectificationTask>;
  getSchema(): Promise<TableSchema[]>;
}
