import SectionEditClient from "../../SectionEditClient";

export default async function SectionEditPage({ params }: { params: { id: string, sectionId: string } }) {
    const resolvedParams = await params;
    return <SectionEditClient projectId={resolvedParams.id} sectionId={resolvedParams.sectionId} />;
}
