export type LegalConfig={businessName:string;address:string;supportEmail:string;supportPhone:string;supportHours:string;grievanceOfficer:string;grievanceEmail:string;jurisdiction:string;complete:boolean};

export function legalConfig():LegalConfig{
  const value={
    businessName:process.env.LEGAL_BUSINESS_NAME?.trim()||"",
    address:process.env.LEGAL_BUSINESS_ADDRESS?.trim()||"",
    supportEmail:process.env.SUPPORT_EMAIL?.trim()||"",
    supportPhone:process.env.SUPPORT_PHONE?.trim()||"",
    supportHours:process.env.SUPPORT_HOURS?.trim()||"Monday-Saturday, 9:00 AM-7:00 PM IST",
    grievanceOfficer:process.env.GRIEVANCE_OFFICER_NAME?.trim()||"",
    grievanceEmail:process.env.GRIEVANCE_EMAIL?.trim()||"",
    jurisdiction:process.env.JURISDICTION?.trim()||"",
  };
  return {...value,complete:Boolean(value.businessName&&value.address&&value.supportEmail&&value.supportPhone&&value.grievanceOfficer&&value.grievanceEmail&&value.jurisdiction)};
}

export function legalConfigurationIssues(){const c=legalConfig();const issues:string[]=[];if(!c.businessName)issues.push("LEGAL_BUSINESS_NAME is required for commercial launch");if(!c.address)issues.push("LEGAL_BUSINESS_ADDRESS is required for commercial launch");if(!c.supportEmail)issues.push("SUPPORT_EMAIL is required for commercial launch");if(!c.supportPhone)issues.push("SUPPORT_PHONE is required for commercial launch");if(!c.grievanceOfficer)issues.push("GRIEVANCE_OFFICER_NAME is required for commercial launch");if(!c.grievanceEmail)issues.push("GRIEVANCE_EMAIL is required for commercial launch");if(!c.jurisdiction)issues.push("JURISDICTION is required for commercial launch");return issues;}
