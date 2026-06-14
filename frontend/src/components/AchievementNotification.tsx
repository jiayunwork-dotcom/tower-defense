import { onMount, onCleanup, createEffect, For } from 'solid-js';
import { useGameContext } from '../store/game.store';
import type { AchievementDef } from '../types/game.types';

export default function AchievementNotification() {
  const store = useGameContext();

  const handleDismiss = (achievement: AchievementDef) => {
    setTimeout(() => {
      store.removeAchievementNotification(achievement.id);
    }, 3000);
  };

  createEffect(() => {
    const notifications = store.achievementNotifications;
    if (notifications.length > 0) {
      const latest = notifications[notifications.length - 1];
      handleDismiss(latest);
    }
  });

  return (
    <div class="achievement-notifications">
      <For each={store.achievementNotifications}>
        {(achievement, index) => (
          <div 
            class="achievement-toast"
            style={{ 'animation-delay': `${index() * 0.1}s` }}
          >
            <div class="achievement-toast-icon">{achievement.icon}</div>
            <div class="achievement-toast-content">
              <div class="achievement-toast-title">成就解锁！</div>
              <div class="achievement-toast-name">{achievement.name}</div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
