import SectionDetailClient from "../SectionDetailClient";

export default async function SectionDetailPage({ params }: { params: { id: string, sectionId: string } }) {
    const resolvedParams = await params;
    return <SectionDetailClient projectId={resolvedParams.id} sectionId={resolvedParams.sectionId} />;
}
