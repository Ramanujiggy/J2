import BeltLoader from './BeltLoader.tsx';

export default function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <BeltLoader />
      <p className="text-sm tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
        Loading
      </p>
    </div>
  );
}
