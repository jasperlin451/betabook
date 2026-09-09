import { TermsContent } from "@/components/terms-content";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description: "Terms for using Betabook’s climbing logbook and community crag database.",
  path: "/terms",
});

export default function TermsPage() {
  return <TermsContent />;
}
