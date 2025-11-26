import ProjectEditClient from "../ProjectEditClient";

export default async function EditProjectPage({ params }: { params: { id: string } }) {
    const resolvedParams = await params;
    return <ProjectEditClient projectId={resolvedParams.id} />;
}
