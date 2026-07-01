import { AuditWizard } from "../../../../../components/audit-wizard";
import { requireSession } from "../../../../../lib/auth/session";
import {
  demoMinimumChecklist,
  demoOperationChecklist,
  demoValueChecklist,
} from "../../../../../lib/config";
import { getChecklistConfigForMode } from "../../../../../lib/production-config";
import { getRepositoryForSession } from "../../../../../lib/repositories";

export default async function NewAuditPage() {
  const user = await requireSession("sv");
  const repository = await getRepositoryForSession(user);
  const stores = await repository.getStoresForSv(user);
  const checklistConfig = getChecklistConfigForMode(user.mode, {
    minimum: demoMinimumChecklist,
    operation: demoOperationChecklist,
    value: demoValueChecklist,
  });

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70">Step Flow</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">5C 評価を開始</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300">
          実運用の前提条件を厳守します。`最低遵守項目` 22 件はすべて初期値が `OK` で表示され、
          問題がある項目だけ `NG` に切り替えます。
          `22 / 22 OK` の場合のみ `運営基準項目` と `価値創造項目` へ進めます。未通過時は `問題指摘`
          を作成し、是正クローズドループへ進みます。
        </p>
      </section>

      <AuditWizard
        stores={stores}
        evaluator={user.name}
        minimumDefinitions={checklistConfig.minimum}
        operationDefinitions={checklistConfig.operation}
        valueDefinitions={checklistConfig.value}
      />
    </div>
  );
}
