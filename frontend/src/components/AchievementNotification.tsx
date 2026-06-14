import { createSignal, For, createEffect, onCleanup } from 'solid-js';
import { useGameContext } from '../store/game.store';
import type { AchievementDef } from '../types/game.types';

interface QueuedNotification {
  achievement: AchievementDef;
  visible: boolean;
  id: number;
}

export default function AchievementNotification() {
  const store = useGameContext();
  const [displayQueue, setDisplayQueue] = createSignal<QueuedNotification[]>([]);
  let nextId = 0;
  let timers: number[] = [];

  const showNext = () => {
    const pending = store.achievementNotifications;
    if (pending.length === 0) return;

    const currentDisplaying = displayQueue().filter(n => n.visible).length;
    if (currentDisplaying >= 3) return;

    const toShow = pending[0];
    const id = nextId++;
    
    setDisplayQueue(prev => [...prev, { achievement: toShow, visible: true, id }]);
    store.removeAchievementNotification(toShow.id);

    const hideTimer = window.setTimeout(() => {
      setDisplayQueue(prev => prev.filter(n => n.id !== id));
      showNext();
    }, 3000);
    timers.push(hideTimer);
  };

  createEffect(() => {
    if (store.achievementNotifications.length > 0) {
      showNext();
    }
  });

  onCleanup(() => {
    timers.forEach(t => window.clearTimeout(t));
  });

  return (
    <div class="achievement-notifications">
      <For each={displayQueue()}>
        {(notification, index) => (
          <div 
            class="achievement-toast"
            style={{ 
              'animation-delay': `${index() * 0.15}s`,
              'top': `${index() * 90}px`
            }}
          >
            <div class="achievement-toast-icon">{notification.achievement.icon}</div>
            <div class="achievement-toast-content">
              <div class="achievement-toast-title">成就解锁！</div>
              <div class="achievement-toast-name">{notification.achievement.name}</div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
