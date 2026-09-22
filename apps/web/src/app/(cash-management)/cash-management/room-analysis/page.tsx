import { Metadata } from 'next';
import { RoomAnalysisClient } from './client';

export const metadata: Metadata = {
  title: 'Room Analysis | Cash Management',
};

export default function RoomAnalysisPage() {
  return <div className="cashier-dark-surface min-h-full bg-[#07111f]"><RoomAnalysisClient /></div>;
}
