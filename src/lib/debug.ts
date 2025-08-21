import { RoutingAgentResult, RoutingType } from "./definition";

export const debugRoutingAgent = (routingAgentResult: RoutingAgentResult) => {
  console.debug(`🔧 Routing Agent Results:`);
  console.debug("🔧 Raw Response: ", routingAgentResult);
  console.debug(`🔧 Reasoning: ${routingAgentResult.reasoning}`);
  console.debug(`🔧 Mode: ${routingAgentResult.mode}`);
  switch (routingAgentResult.mode) {
    case RoutingType.SQL:
      console.debug(`🔧 SQL: ${routingAgentResult.sql}`);
      console.debug(`🔧 Desired Chart Type: ${routingAgentResult.chartType}`);
      break;
    case RoutingType.VECTOR:
      console.debug(`🔧 Sematic Query: ${routingAgentResult.semanticQuery}`);
      break;
    case RoutingType.OTHER:
      break;
    default:
      break;
  }
};
