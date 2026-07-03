# Debug Session: audit-send-fieldname
- **Status**: [OPEN]
- **Issue**: 点击 `5C評価を送信` 仍报 `FieldNameNotFound`
- **Debug Server**: pending
- **Log File**: .dbg/trae-debug-log-audit-send-fieldname.ndjson

## Reproduction Steps
1. 使用 SV 账号进入评价页面
2. 点击 `5C評価を送信`
3. 观察线上/本地返回的 `FieldNameNotFound`

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `createAudit()` 写入四张表之一时，显式字段名仍有一处与真实 Base 不一致 | High | Low | Pending |
| B | checklist 明细字段自动映射在运行时解析成了当前表不存在的字段名 | High | Low | Pending |
| C | 某个字段在不同表里同名异义，当前 payload 把值写进了错误表 | Medium | Low | Pending |
| D | `createRecord()` 实际请求体与代码预期不一致，序列化后字段名发生了偏差 | Medium | Medium | Pending |
| E | 错误并不来自 `createAudit()` 主链路，而是发送通知的后续动作抛出的伪装错误 | Low | Low | Pending |

## Log Evidence
- Instrumentation added in `src/lib/repositories/lark-base-repository.ts`
- Awaiting reproduction after clicking `5C評価を送信`

## Verification Conclusion
[Pending]
