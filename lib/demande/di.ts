import { db } from "../../db"
import { demandeEventBus } from "../demande-event-bus"
import { DemandeQueryAdapter } from "./adapters/demande-query-adapter"
import { DemandeFactoryAdapter } from "./adapters/demande-factory-adapter"
import { DemandeWorkflowAdapter } from "./adapters/demande-workflow-adapter"
import { DemandeDeplacementService } from "../demande-service"

export const demandeService = new DemandeDeplacementService(
  new DemandeQueryAdapter(db),
  new DemandeFactoryAdapter(db, demandeEventBus),
  new DemandeWorkflowAdapter(db, demandeEventBus),
  db
)