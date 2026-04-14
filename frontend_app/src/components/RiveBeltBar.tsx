import { useCallback, useRef, useState } from 'react';
import { useRive, useStateMachineInput, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import BeltBar from './BeltBar.tsx';

// ── Rank mapping ──────────────────────────────────────────────────────────

const RANK_INDEX: Record<string, number> = {
  white: 0, blue: 1, purple: 2, brown: 3, black: 4,
};

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  rank?: string | null;
  stripes?: number;
}

export default function RiveBeltBar({ rank, stripes }: Props) {
  const [riveFailed, setRiveFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { rive, RiveComponent } = useRive({
    src: '/assets/belt.riv',
    stateMachines: 'BeltStateMachine',
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.TopCenter }),
    onLoadError: () => setRiveFailed(true),
  });

  // State machine inputs
  const rankInput = useStateMachineInput(rive, 'BeltStateMachine', 'rank');
  const stripesInput = useStateMachineInput(rive, 'BeltStateMachine', 'stripes');
  const mouseXInput = useStateMachineInput(rive, 'BeltStateMachine', 'mouseX');
  const isHoveringInput = useStateMachineInput(rive, 'BeltStateMachine', 'isHovering');
  const whipLeftInput = useStateMachineInput(rive, 'BeltStateMachine', 'whipLeft');
  const whipRightInput = useStateMachineInput(rive, 'BeltStateMachine', 'whipRight');

  // Sync React props → Rive inputs
  if (rankInput && rank) {
    const idx = RANK_INDEX[rank] ?? 0;
    if (rankInput.value !== idx) rankInput.value = idx;
  }
  if (stripesInput) {
    const s = Math.max(0, Math.min(4, stripes ?? 0));
    if (stripesInput.value !== s) stripesInput.value = s;
  }

  // Pointer tracking for interactive tail follow
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!mouseXInput || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const dx = e.clientX - centerX;
    const clamped = Math.max(-34, Math.min(34, dx * 0.78));
    mouseXInput.value = clamped;
  }, [mouseXInput]);

  const handlePointerEnter = useCallback(() => {
    if (isHoveringInput) isHoveringInput.value = true;
  }, [isHoveringInput]);

  const handlePointerLeave = useCallback(() => {
    if (isHoveringInput) isHoveringInput.value = false;
    if (mouseXInput) mouseXInput.value = 0;
  }, [isHoveringInput, mouseXInput]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftHalf = clickX < rect.width / 2;

    if (isLeftHalf && whipLeftInput) {
      whipLeftInput.fire();
    } else if (!isLeftHalf && whipRightInput) {
      whipRightInput.fire();
    }
  }, [whipLeftInput, whipRightInput]);

  // ── Fallback: render the existing CSS BeltBar if .riv fails to load ────
  if (riveFailed) {
    return <BeltBar rank={rank} stripes={stripes} />;
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: 42, position: 'relative', cursor: 'grab' }}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <RiveComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
