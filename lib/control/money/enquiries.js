import { ApiError } from "../../staff_access/errors.js";
import { packageEnquiryView, sponsorEnquiryView } from "./views.js";

// The two enquiry inboxes Control manages: leads from an event's packages page and its sponsorship prospectus.
export const ENQUIRY_KINDS = {
  packages: { table: "package_enquiries", permission: "events.packages.view", view: packageEnquiryView },
  sponsors: { table: "sponsor_enquiries", permission: "events.sponsors_expo.view", view: sponsorEnquiryView },
};

export function enquiryKind(kind) {
  const found = ENQUIRY_KINDS[kind];
  if (!found) throw new ApiError("not_found", 404, "Not found.");
  return found;
}
