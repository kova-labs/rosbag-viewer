import { notFound } from 'next/navigation';
import { getBagById } from '@/app/actions/bags';
import { BagDetailView } from '@/components/bag-detail-view';

interface BagDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function BagDetailPage({ params }: BagDetailPageProps) {
    const { id } = await params;
    const bagId = parseInt(id, 10);

    if (isNaN(bagId)) {
        notFound();
    }

    const bag = await getBagById(bagId);

    if (!bag) {
        notFound();
    }

    return <BagDetailView bag={bag} />;
}

