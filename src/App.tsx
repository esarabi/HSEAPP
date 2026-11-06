import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { FindingList } from './pages/Findings'
import { IncidentDetail, IncidentForm, IncidentList } from './pages/Incidents'
import { InspectionDetail, InspectionForm, InspectionList } from './pages/Inspections'
import { PeopleList, PersonDetail } from './pages/People'
import { PermitDetail, PermitList, PermitNew } from './pages/Permits'
import { Settings } from './pages/Settings'
import { TaskList } from './pages/Tasks'
import { ContractList } from './pages/Contracts'
import { CatalogPage } from './pages/Catalog'
import { Reports } from './pages/Reports'
import { More } from './pages/More'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contracts" element={<ContractList />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/more" element={<More />} />
          <Route path="/inspections" element={<InspectionList />} />
          <Route path="/inspections/new" element={<InspectionForm />} />
          <Route path="/inspections/:id" element={<InspectionDetail />} />
          <Route path="/inspections/:id/edit" element={<InspectionForm />} />
          <Route path="/visits/*" element={<Navigate to="/inspections" replace />} />
          <Route path="/findings" element={<FindingList />} />
          <Route path="/incidents" element={<IncidentList />} />
          <Route path="/incidents/new" element={<IncidentForm />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/incidents/:id/edit" element={<IncidentForm />} />
          <Route path="/permits" element={<PermitList />} />
          <Route path="/permits/new" element={<PermitNew />} />
          <Route path="/permits/:id" element={<PermitDetail />} />
          <Route path="/people" element={<PeopleList />} />
          <Route path="/people/:id" element={<PersonDetail />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
