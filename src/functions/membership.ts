import { environmentConfig } from "../config.js";
import { RunEnvironment } from "../roles.js";

type MembershipCheckResponse = {
  netId: string;
  isPaidMember: boolean;
};

async function checkMembershipStatus(netId: string) {
  const response: MembershipCheckResponse = (await (
    await fetch(
      `${environmentConfig[process.env.RunEnvironment as RunEnvironment].MembershipCheckEndpoint}?netId=${netId}`,
    )
  ).json()) as MembershipCheckResponse;
  return response.isPaidMember;
}

export { checkMembershipStatus };
