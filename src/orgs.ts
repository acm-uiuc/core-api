export const SIGList = [
  "SIGPwny",
  "SIGCHI",
  "GameBuilders",
  "SIGAIDA",
  "SIGGRAPH",
  "ICPC",
  "SIGMobile",
  "SIGMusic",
  "GLUG",
  "SIGNLL",
  "SIGma",
  "SIGQuantum",
  "SIGecom",
  "SIGPLAN",
  "SIGPolicy",
  "SIGARCH",
] as const;

export const CommitteeList = [
  "Infrastructure Committe",
  "Social Committee",
  "Mentorship Committee",
] as const;
export const OrganizationList = ["ACM", ...SIGList, ...CommitteeList] as const;