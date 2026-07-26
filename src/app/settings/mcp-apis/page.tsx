import { auth } from "@/lib/auth";
import { SettingsHeader } from "@/components/settings-header";
import { ApiKeysForm } from "@/components/api-keys-form";
import { listApiKeys } from "@/lib/actions/api-keys";

type EndpointField = { name: string; required?: boolean; note?: string; example: string | number };

function Endpoint({
  method,
  path,
  note,
  fields,
}: {
  method: string;
  path: string;
  note?: string;
  fields: EndpointField[];
}) {
  const body = JSON.stringify(
    Object.fromEntries(fields.filter((f) => f.required).map((f) => [f.name, f.example])),
    null,
    2
  );
  const curl = `curl https://your-domain.com${path} \\\n  -H "Authorization: Bearer $CRM_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(Object.fromEntries(fields.map((f) => [f.name, f.example])))}'`;

  return (
    <div>
      <p className="font-mono text-[13px]">
        {method} {path}
      </p>
      {note && <p className="text-[12px] text-subtle mt-0.5">{note}</p>}
      <table className="mt-2 w-full text-[12px]">
        <tbody>
          {fields.map((f) => (
            <tr key={f.name} className="border-t border-border">
              <td className="py-1 pr-3 font-mono whitespace-nowrap align-top">
                {f.name}
                {f.required && <span className="text-red-400">*</span>}
              </td>
              <td className="py-1 text-subtle align-top">{f.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="mt-2 group">
        <summary className="text-[12px] text-accent cursor-pointer select-none list-none flex items-center gap-1">
          <span className="transition-transform group-open:rotate-90">▸</span> Example request
        </summary>
        <pre className="mt-2 text-[11px] bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {curl}
        </pre>
        <p className="text-[11px] text-subtle mt-2">Minimal body (required fields only):</p>
        <pre className="mt-1 text-[11px] bg-muted rounded-md p-3 overflow-x-auto">{body}</pre>
      </details>
    </div>
  );
}

export default async function McpApisPage() {
  const session = await auth();
  const keys = await listApiKeys();

  return (
    <>
      <SettingsHeader crumbs={["Workspace", "MCP & APIs"]} />
      <div className="px-8 py-10">
        <h1 className="text-xl font-medium">MCP & APIs</h1>
        <p className="text-[13px] text-subtle mt-2">
          Create an API key, then send it as <code>Authorization: Bearer &lt;key&gt;</code> on every request below.
        </p>

        <div className="mt-6 space-y-6 max-w-2xl">
          <Endpoint
            method="POST"
            path="/api/v1/companies"
            fields={[
              { name: "name", required: true, example: "Acme Inc" },
              { name: "domain", example: "acme.com" },
              { name: "address", example: "123 Main St" },
              { name: "linkedin", example: "linkedin.com/company/acme" },
              { name: "annualRevenue", example: "$1M-$5M" },
            ]}
          />
          <Endpoint
            method="POST"
            path="/api/v1/contacts"
            note="Contacts are stored as people (Person)."
            fields={[
              { name: "firstName", required: true, example: "Jane" },
              { name: "lastName", example: "Doe" },
              { name: "email", example: "jane@acme.com" },
              { name: "phone", example: "+1 555 123 4567" },
              { name: "jobTitle", example: "VP Sales" },
              { name: "linkedin", example: "linkedin.com/in/janedoe" },
              { name: "companyId", note: "id returned by /api/v1/companies", example: "cmr...xyz" },
            ]}
          />
          <Endpoint
            method="POST"
            path="/api/v1/deals"
            note="Deals are stored as opportunities (Opportunity)."
            fields={[
              { name: "name", required: true, example: "Acme Renewal" },
              { name: "value", note: "integer, defaults to 0", example: 5000 },
              { name: "stage", note: "defaults to \"New\"", example: "New" },
              { name: "companyId", example: "cmr...xyz" },
              { name: "contactId", note: "id returned by /api/v1/contacts", example: "cmr...abc" },
            ]}
          />
        </div>

        <ApiKeysForm keys={keys} canManage={session?.user?.role === "owner"} />
      </div>
    </>
  );
}
