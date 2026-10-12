import ContactImporter from "@/components/ContactImporter";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ImportContactsPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <ContactImporter contactListId={id} />
      </div>
    </main>
  );
}
