import { Metadata } from 'next';
import RecipesPage from '@/app/(inventory)/inventory/cost-control/recipes/page';

export const metadata: Metadata = {
  title: 'Recipe Management | F&B Management',
};

export default function FnbRecipesPage() {
  return <RecipesPage />;
}
