import type { ChecklistDefinition } from "./domain";

function parseChecklistConfig(value: string | undefined): ChecklistDefinition[] | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as ChecklistDefinition[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createGeneratedChecklist(options: {
  prefix: string;
  count: number;
  group: string;
  labelPrefix: string;
}): ChecklistDefinition[] {
  return Array.from({ length: options.count }, (_, index) => {
    const order = String(index + 1).padStart(2, "0");
    return {
      key: `${options.prefix}-${order}`,
      label: `${options.labelPrefix} ${order}`,
      group: options.group,
      maxScore: 1,
    };
  });
}

export const appConfig = {
  title: "５C管理プラットフォーム",
  larkAppId: process.env.LARK_APP_ID ?? "cli_aab135f2e0b85e15",
  larkAppSecret: process.env.LARK_APP_SECRET ?? "",
  larkRedirectUri:
    process.env.LARK_REDIRECT_URI ?? "https://qscmanagement.mahuan220.workers.dev/api/auth/lark/callback",
  larkBaseAppToken: process.env.LARK_BASE_APP_TOKEN ?? "RADabvBDpavPzFsMmIHj7KOxpXc",
  larkStoreTableId: process.env.LARK_BASE_STORE_TABLE_ID ?? "tblKmUWvhrg8v1n0",
  larkMinimumTableId: process.env.LARK_BASE_MINIMUM_TABLE_ID ?? "tblVQA4TkDmBAImb",
  larkOperationTableId: process.env.LARK_BASE_OPERATION_TABLE_ID ?? "tbldp5mMzD6BRkuj",
  larkValueTableId: process.env.LARK_BASE_VALUE_TABLE_ID ?? "tblq0BeYXTzhCqcs",
  larkIssueTableId: process.env.LARK_BASE_ISSUE_TABLE_ID ?? "tblatoQ7jqgteyQP",
  larkItemMasterTableId: process.env.LARK_BASE_ITEM_MASTER_TABLE_ID ?? "tblQJcMuzwota38S",
  larkAuthBaseUrl: process.env.LARK_AUTH_BASE_URL ?? "https://accounts.larksuite.com",
  larkOpenApiBaseUrl: process.env.LARK_OPEN_API_BASE_URL ?? "https://open.larksuite.com",
  storeOwnerFieldId: process.env.LARK_STORE_OWNER_FIELD_ID ?? "店舗ユーザーID",
  svOwnerFieldId: process.env.LARK_SV_OWNER_FIELD_ID ?? "SVユーザーID",
  oauthScope:
    process.env.LARK_OAUTH_SCOPE ??
    "offline_access bitable:app bitable:app:readonly contact:user.base:readonly",
};

const defaultOperationChecklist: ChecklistDefinition[] = createGeneratedChecklist({
  prefix: "operation",
  count: 50,
  group: "運営基準",
  labelPrefix: "運営基準項目",
});

export const demoMinimumChecklist =
  parseChecklistConfig(process.env.LARK_MINIMUM_CHECKLIST) ??
  createGeneratedChecklist({
    prefix: "minimum",
    count: 22,
    group: "最低遵守",
    labelPrefix: "最低遵守項目",
  });

export const demoOperationChecklist =
  parseChecklistConfig(process.env.LARK_OPERATION_CHECKLIST) ?? defaultOperationChecklist;

export const demoValueChecklist =
  parseChecklistConfig(process.env.LARK_VALUE_CHECKLIST) ??
  createGeneratedChecklist({
    prefix: "value",
    count: 20,
    group: "価値創造",
    labelPrefix: "価値創造項目",
  });
