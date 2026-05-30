import { Construction } from "lucide-react";
import EmployeeLayout from "../../components/layouts/EmployeeLayout";

export default function ComingSoon({ title = "Coming soon", description }) {
  return (
    <EmployeeLayout>
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md w-full text-center bg-white border border-evegah-border rounded-2xl shadow-card p-10">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-light text-evegah-primary">
            <Construction className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold text-evegah-text">{title}</h1>
          <p className="mt-3 text-sm text-evegah-muted">
            {description ||
              "This page is being built. Check back soon — it'll be available in an upcoming release."}
          </p>
        </div>
      </div>
    </EmployeeLayout>
  );
}
