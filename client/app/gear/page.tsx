import { Suspense } from 'react';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { GearRentalClient } from './GearRentalClient';

export const metadata = {
  title: 'Gear Rentals — BoxRetreat · Luquillo, Puerto Rico',
  description: 'Rent surfboards, kayaks, snorkel sets, GoPros, bikes, and beach sets. Delivered to BoxRetreat.',
};

export default function GearPage() {
  return (
    <>
      <Nav />
      <main>
        <Suspense fallback={null}>
          <GearRentalClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
