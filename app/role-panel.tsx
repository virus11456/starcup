"use client";
import { useState } from "react";
import { roleFor, skillReminders } from "@/lib/roles";
import type { RoomView } from "@/lib/game";

export function Portrait({
  avatar,
  className = "",
}: {
  avatar: number;
  className?: string;
}) {
  const role = roleFor(avatar);
  const [failed, setFailed] = useState(false);
  return (
    <span className={`role-portrait ${className}`}>
      {failed ? (
        <span>{role.name}</span>
      ) : (
        <img
          src={`/roles/${role.id}.png`}
          alt={`${role.name}角色肖像`}
          width={355}
          height={491}
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
export default function RolePanel({
  room,
  cardId,
  inspect,
}: {
  room: RoomView;
  cardId?: string;
  inspect: (avatar: number) => void;
}) {
  const me = room.players.find((p) => p.id === room.me)!;
  const role = roleFor(me.avatar);
  const reminders = skillReminders(room, cardId);
  return (
    <section className="role-panel">
      <button className="my-role" onClick={() => inspect(me.avatar)}>
        <Portrait avatar={me.avatar} />
        <span>
          <small>你的參考角色</small>
          <strong>{role.name}</strong>
          <em>
            {role.person} · {role.faction}
          </em>
          <small>查看完整角色與技能卡 ↗</small>
        </span>
      </button>
      <p className="role-status">
        角色圖片與教學提醒已加入；角色技能尚未開放結算。
      </p>
      {reminders.length > 0 && (
        <div className="skill-alert" role="status">
          <strong>✦ 相關技能時機</strong>
          {reminders.map((text) => (
            <p key={text}>{text}</p>
          ))}
          <small>原作時機提示，本局不會套用上述技能效果。</small>
        </div>
      )}
      <details className="role-skills">
        <summary>角色特殊技與使用條件（{role.skills.length}）</summary>
        {role.skills.map((skill) => (
          <div key={skill.name}>
            <strong>
              {skill.name}
              <span>{skill.type}</span>
            </strong>
            <p>時機：{skill.timing}</p>
            <p>需要：{skill.requirement}</p>
            <p>{skill.description}</p>
            <small>尚未實作 · 不可施放</small>
          </div>
        ))}
      </details>
    </section>
  );
}
