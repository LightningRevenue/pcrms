export type Task = {
  id: string;
  title: string;
  related: string;
  due: string;
  done: boolean;
};

export const todayTasks: Task[] = [
  { id: "1", title: "Call Andrei re: renewal terms", related: "Vector Labs", due: "10:00", done: false },
  { id: "2", title: "Send proposal follow-up", related: "Marea Neagra SRL", due: "11:30", done: false },
  { id: "3", title: "Review contract redlines", related: "Nexora", due: "14:00", done: true },
  { id: "4", title: "Prep demo for Friday", related: "Orbit Systems", due: "16:00", done: false },
];

export type Activity = {
  id: string;
  text: string;
  time: string;
};

export const recentActivity: Activity[] = [
  { id: "1", text: "Deal \"Nexora — Q3 expansion\" moved to Negotiation", time: "1h ago" },
  { id: "2", text: "New contact added: Elena Popescu (Vector Labs)", time: "3h ago" },
  { id: "3", text: "Email opened by Marea Neagra SRL", time: "5h ago" },
];

export const stats = [
  { label: "Open deals", value: "18" },
  { label: "Tasks due today", value: "4" },
  { label: "Pipeline value", value: "€142k" },
];

export type ContactStatus = "Lead" | "Active" | "Customer" | "Churned";

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ContactStatus;
  owner: string;
  nextActivity: string;
  jobTitle: string;
  linkedin: string;
  createdAt: string;
  createdBy: string;
};

export const contactStatuses: ContactStatus[] = ["Lead", "Active", "Customer", "Churned"];

export const contacts: Contact[] = [
  { id: "1", name: "Elena Popescu", email: "elena@vectorlabs.io", phone: "+40 721 002 331", company: "Vector Labs", status: "Active", owner: "Antonio", nextActivity: "Call — Jul 21", jobTitle: "VP Engineering", linkedin: "linkedin.com/in/elenapopescu", createdAt: "3 days ago", createdBy: "Antonio Cotruta" },
  { id: "2", name: "Andrei Marin", email: "andrei@nexora.com", phone: "+40 733 118 220", company: "Nexora", status: "Customer", owner: "Antonio", nextActivity: "Renewal — Jul 25", jobTitle: "CEO", linkedin: "linkedin.com/in/andreimarin", createdAt: "2 weeks ago", createdBy: "Antonio Cotruta" },
  { id: "3", name: "Ioana Stan", email: "ioana@mareaneagra.ro", phone: "+40 745 990 112", company: "Marea Neagra SRL", status: "Lead", owner: "Cristina", nextActivity: "Follow-up — Jul 19", jobTitle: "Procurement Lead", linkedin: "linkedin.com/in/ioanastan", createdAt: "1 day ago", createdBy: "Cristina Popa" },
  { id: "4", name: "Radu Dumitrescu", email: "radu@orbitsystems.dev", phone: "+40 722 441 087", company: "Orbit Systems", status: "Active", owner: "Antonio", nextActivity: "Demo — Jul 22", jobTitle: "CTO", linkedin: "linkedin.com/in/radudumitrescu", createdAt: "5 days ago", createdBy: "Antonio Cotruta" },
  { id: "5", name: "Maria Ionescu", email: "maria@brightpath.co", phone: "+40 761 205 993", company: "Bright Path", status: "Customer", owner: "Cristina", nextActivity: "—", jobTitle: "Head of Ops", linkedin: "linkedin.com/in/mariaionescu", createdAt: "1 month ago", createdBy: "Cristina Popa" },
  { id: "6", name: "Cristian Vasile", email: "cristian@northwind.eu", phone: "+40 788 552 004", company: "Northwind", status: "Lead", owner: "Antonio", nextActivity: "Call — Jul 20", jobTitle: "Founder", linkedin: "linkedin.com/in/cristianvasile", createdAt: "6 hours ago", createdBy: "Antonio Cotruta" },
  { id: "7", name: "Diana Georgescu", email: "diana@stellar.io", phone: "+40 799 331 667", company: "Stellar Corp", status: "Churned", owner: "Cristina", nextActivity: "—", jobTitle: "Marketing Director", linkedin: "linkedin.com/in/dianageorgescu", createdAt: "4 months ago", createdBy: "Cristina Popa" },
  { id: "8", name: "Mihai Constantin", email: "mihai@fluxware.com", phone: "+40 712 887 456", company: "Fluxware", status: "Active", owner: "Antonio", nextActivity: "Check-in — Jul 24", jobTitle: "Product Manager", linkedin: "linkedin.com/in/mihaiconstantin", createdAt: "2 days ago", createdBy: "Antonio Cotruta" },
  { id: "9", name: "Ana Radu", email: "ana@greenfield.ro", phone: "+40 734 662 890", company: "Greenfield", status: "Lead", owner: "Cristina", nextActivity: "Intro call — Jul 23", jobTitle: "Office Manager", linkedin: "linkedin.com/in/anaradu", createdAt: "12 hours ago", createdBy: "Cristina Popa" },
  { id: "10", name: "Bogdan Preda", email: "bogdan@nexora.com", phone: "+40 725 118 334", company: "Nexora", status: "Customer", owner: "Antonio", nextActivity: "—", jobTitle: "Co-owner", linkedin: "linkedin.com/in/bogdanpreda", createdAt: "2 weeks ago", createdBy: "Antonio Cotruta" },
  { id: "11", name: "Larisa Enache", email: "larisa@orbitsystems.dev", phone: "+40 741 990 228", company: "Orbit Systems", status: "Churned", owner: "Cristina", nextActivity: "—", jobTitle: "Sales Lead", linkedin: "linkedin.com/in/larisaenache", createdAt: "5 months ago", createdBy: "Cristina Popa" },
  { id: "12", name: "Tudor Barbu", email: "tudor@vectorlabs.io", phone: "+40 753 224 671", company: "Vector Labs", status: "Customer", owner: "Antonio", nextActivity: "Upsell — Jul 28", jobTitle: "Co-owner", linkedin: "linkedin.com/in/tudorbarbu", createdAt: "8 hours ago", createdBy: "Antonio Cotruta" },
];

export type Company = {
  id: string;
  name: string;
  domain: string;
  createdBy: string;
  owner: string;
  createdAt: string;
  linkedin: string;
  address: string;
  lastContact: string;
  lastContactItem: string;
  annualRevenue: string;
};

export const companies: Company[] = [
  { id: "1", name: "Vector Labs", domain: "vectorlabs.io", createdBy: "Antonio Cotruta", owner: "Antonio", createdAt: "3 days ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "2", name: "Nexora", domain: "nexora.com", createdBy: "Antonio Cotruta", owner: "Antonio", createdAt: "2 weeks ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "3", name: "Marea Neagra SRL", domain: "mareaneagra.ro", createdBy: "Cristina Popa", owner: "Cristina", createdAt: "1 day ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "4", name: "Orbit Systems", domain: "orbitsystems.dev", createdBy: "Antonio Cotruta", owner: "Antonio", createdAt: "5 days ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "5", name: "Bright Path", domain: "brightpath.co", createdBy: "Cristina Popa", owner: "Cristina", createdAt: "1 month ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "6", name: "Northwind", domain: "northwind.eu", createdBy: "Antonio Cotruta", owner: "Antonio", createdAt: "6 hours ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "7", name: "Stellar Corp", domain: "stellar.io", createdBy: "Cristina Popa", owner: "Cristina", createdAt: "4 months ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "8", name: "Fluxware", domain: "fluxware.com", createdBy: "Antonio Cotruta", owner: "Antonio", createdAt: "2 days ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
  { id: "9", name: "Greenfield", domain: "greenfield.ro", createdBy: "Cristina Popa", owner: "Cristina", createdAt: "12 hours ago", linkedin: "", address: "", lastContact: "", lastContactItem: "", annualRevenue: "" },
];

export type OpportunityStage = "New" | "Screening" | "Meeting" | "Proposal" | "Customer";

export const opportunityStages: OpportunityStage[] = ["New", "Screening", "Meeting", "Proposal", "Customer"];

export type Opportunity = {
  id: string;
  name: string;
  value: number;
  stage: OpportunityStage;
  owner: string;
  closeDate: string;
  company: string;
  contact: string;
};

export const opportunities: Opportunity[] = [
  { id: "1", name: "Untitled", value: 1500, stage: "Screening", owner: "Costin-Antonio Cotruta", closeDate: "1 Jul, 2026 22:50", company: "Untitled", contact: "Alin Urianu" },
];

export type FieldChange = {
  field: string;
  icon: "user" | "stage" | "amount" | "company" | "date" | "contact";
  value: string;
  badge?: boolean;
};

export type OpportunityTimelineEvent = {
  id: string;
  kind: "field-update" | "created";
  actor: string;
  time: string;
  changes?: FieldChange[];
};

export const opportunityTimeline: Record<string, OpportunityTimelineEvent[]> = {
  "1": [
    {
      id: "e1",
      kind: "field-update",
      actor: "You",
      time: "half a minute ago",
      changes: [
        { field: "Owner", icon: "user", value: "Costin-Antonio Cotruta" },
        { field: "Stage", icon: "stage", value: "Screening", badge: true },
        { field: "Amount", icon: "amount", value: "$1.5k" },
        { field: "Company", icon: "company", value: "" },
        { field: "Close date", icon: "date", value: "1 Jul, 2026 22:50" },
        { field: "Point of Contact", icon: "contact", value: "Alin Urianu" },
      ],
    },
    { id: "e2", kind: "created", actor: "You", time: "less than a minute ago" },
  ],
};

export type TimelineEvent = {
  id: string;
  text: string;
  actor: string;
  time: string;
};

export const contactTimeline: Record<string, TimelineEvent[]> = {
  "1": [{ id: "t1", text: "was created by", actor: "You", time: "3 days ago" }],
  "12": [
    { id: "t1", text: "was created by", actor: "You", time: "8 hours ago" },
    { id: "t2", text: "status changed to Customer by", actor: "You", time: "6 hours ago" },
  ],
};

export const companyTimeline: Record<string, TimelineEvent[]> = {
  "1": [{ id: "t1", text: "was created by", actor: "You", time: "3 days ago" }],
};
