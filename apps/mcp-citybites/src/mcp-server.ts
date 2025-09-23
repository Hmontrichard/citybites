import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  MapsExportSchema,
  MapsExportResultSchema,
  PdfBuildSchema,
  PdfBuildResultSchema,
  PlacesSearchSchema,
  PlacesSearchResultSchema,
  RouteOptimizeSchema,
  RouteOptimizeResultSchema,
  type MapsExportInput,
  type PdfBuildInput,
  type PlacesSearchInput,
  type RouteOptimizeInput,
  handleMapsExport,
  handlePdfBuild,
  handlePlacesSearch,
  handleRoutesOptimize,
} from "./tools.js";

const server = new McpServer({ name: "citybites-mcp", version: "0.1.0" });

function buildToolResult<T>(summary: string, structuredContent: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: summary,
      },
    ],
    structuredContent,
  };
}

server.registerTool(
  "places.search",
  {
    title: "Recherche de lieux",
    description: "Trouve des spots gourmands dans la ville spécifiée",
    inputSchema: PlacesSearchSchema.shape,
    outputSchema: PlacesSearchResultSchema.shape,
  },
  async (input: PlacesSearchInput) => {
    const result = await handlePlacesSearch(input);
    const summary = result.results.length
      ? `Trouvé ${result.results.length} lieux (${result.source}).`
      : `Aucun lieu trouvé (${result.source}).`;
    return buildToolResult(summary, PlacesSearchResultSchema.parse(result));
  },
);

server.registerTool(
  "routes.optimize",
  {
    title: "Optimisation d'itinéraire",
    description: "Calcule un ordre simple et une distance indicative",
    inputSchema: RouteOptimizeSchema.shape,
    outputSchema: RouteOptimizeResultSchema.shape,
  },
  async (input: RouteOptimizeInput) => {
    const result = handleRoutesOptimize(input);
    const summary = `Itinéraire de ${result.order.length} étapes pour ${result.distanceKm.toFixed(1)} km.`;
    return buildToolResult(summary, RouteOptimizeResultSchema.parse(result));
  },
);

server.registerTool(
  "maps.export",
  {
    title: "Export de carte",
    description: "Produit un fichier GeoJSON ou KML pour Google Maps",
    inputSchema: MapsExportSchema.shape,
    outputSchema: MapsExportResultSchema.shape,
  },
  async (input: MapsExportInput) => {
    const result = handleMapsExport(input);
    const summary = `Carte exportée en ${result.filename}.`;
    return buildToolResult(summary, MapsExportResultSchema.parse(result));
  },
);

server.registerTool(
  "pdf.build",
  {
    title: "Générateur de guide",
    description: "Assemble un mini-guide CityBites en PDF ou HTML",
    inputSchema: PdfBuildSchema.shape,
    outputSchema: PdfBuildResultSchema.shape,
  },
  async (input: PdfBuildInput) => {
    const result = await handlePdfBuild(input);
    const summary = result.format === "pdf" ? "Guide PDF généré." : "Guide HTML disponible.";
    return buildToolResult(summary, PdfBuildResultSchema.parse(result));
  },
);

const transport = new StdioServerTransport();

server
  .connect(transport)
  .catch((error: unknown) => {
    console.error("Failed to start MCP server", error);
    process.exit(1);
  });
