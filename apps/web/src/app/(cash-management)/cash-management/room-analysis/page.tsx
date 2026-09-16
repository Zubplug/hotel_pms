import { Metadata } from 'next';
import { RoomAnalysisClient } from './client';

export const metadata: Metadata = {
  title: 'Room Analysis | Cash Management',
};

export default function RoomAnalysisPage() {
  return <RoomAnalysisClient />;
}
