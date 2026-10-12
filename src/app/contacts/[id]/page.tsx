import Spreadsheet from "@/components/Spreadsheet";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ContactListPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Spreadsheet contactListId={id} />
      </div>
    </main>
  );
}
