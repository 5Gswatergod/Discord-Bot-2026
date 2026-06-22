import assert from "node:assert/strict";
import test from "node:test";

import {
  automationRuleInputSchema,
  automationRulesUpdateSchema,
  evaluateAutomationConditions
} from "@guildforge/shared";

function baseRule() {
  return {
    name: "關鍵字回覆",
    trigger: "MESSAGE_CREATE" as const,
    actions: [
      {
        type: "SEND_MESSAGE" as const,
        channelId: null,
        content: "收到 {user}"
      }
    ]
  };
}

test("provides safe automation defaults", () => {
  const rule = automationRuleInputSchema.parse(baseRule());

  assert.equal(rule.enabled, true);
  assert.equal(rule.stopProcessing, false);
  assert.equal(rule.cooldownSeconds, 0);
  assert.equal(rule.conditions.timeZone, "Asia/Taipei");
  assert.deepEqual(rule.conditions.channelIds, []);
});

test("rejects invalid event actions and role loops", () => {
  assert.equal(
    automationRuleInputSchema.safeParse({
      ...baseRule(),
      trigger: "MEMBER_JOIN",
      actions: [{ type: "DELETE_MESSAGE" }]
    }).success,
    false
  );
  assert.equal(
    automationRuleInputSchema.safeParse({
      ...baseRule(),
      trigger: "MEMBER_ROLE_UPDATE",
      triggerConfig: {
        roleId: "12345",
        roleChange: "ADDED"
      },
      actions: [{ type: "ADD_ROLE", roleId: "12345" }]
    }).success,
    false
  );
});

test("rejects duplicate automation rule names", () => {
  assert.equal(
    automationRulesUpdateSchema.safeParse({
      rules: [
        baseRule(),
        {
          ...baseRule(),
          name: "關鍵字回覆"
        }
      ]
    }).success,
    false
  );
  assert.equal(
    automationRulesUpdateSchema.safeParse({
      rules: [
        { ...baseRule(), id: "rule-1" },
        { ...baseRule(), id: "rule-1", name: "另一個規則" }
      ]
    }).success,
    false
  );
});

test("evaluates channel, role, keyword, weekday, and time conditions", () => {
  const rule = automationRuleInputSchema.parse({
    ...baseRule(),
    conditions: {
      channelIds: ["12345"],
      requiredRoleIds: ["23456"],
      excludedRoleIds: ["34567"],
      keywords: ["hydrava", "help"],
      keywordMode: "ALL",
      activeDays: [1],
      startTime: "09:00",
      endTime: "18:00",
      timeZone: "Asia/Taipei"
    }
  });
  const matched = evaluateAutomationConditions(rule.conditions, {
    content: "Hydrava help",
    channelId: "12345",
    roleIds: ["23456"],
    occurredAt: new Date("2026-06-22T04:00:00.000Z")
  });
  const blocked = evaluateAutomationConditions(rule.conditions, {
    content: "Hydrava help",
    channelId: "12345",
    roleIds: ["23456", "34567"],
    occurredAt: new Date("2026-06-22T04:00:00.000Z")
  });

  assert.equal(matched.matched, true);
  assert.equal(blocked.matched, false);
  assert.ok(blocked.failures.includes("包含排除的身分組"));
});
