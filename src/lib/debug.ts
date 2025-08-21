import { RoutingAgentResult, RoutingType } from "./definition";

export const debugRoutingAgent = (routingAgentResult: RoutingAgentResult) => {
  console.log(`Routing Agent Results:`);
  console.log(`Reasoning: ${routingAgentResult.reasoning}`);
  console.log(`Mode: ${routingAgentResult.mode}`);
  switch (routingAgentResult.mode) {
    case RoutingType.SQL:
      console.log(`SQL: ${routingAgentResult.sql}`);
      console.log(`Desired Chart Type: ${routingAgentResult.chartType}`);
      break;
    case RoutingType.VECTOR:
      console.log(`Sematic Query: ${routingAgentResult.semanticQuery}`);
      break;
    case RoutingType.OTHER:
      break;
    default:
      break;
  }
};
