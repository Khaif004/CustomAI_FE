import { Router, Route } from "./components/Router";
import { ChatbotApp } from "./components/ChatbotApp";
import { Login } from "./components/Login";
import { Callback } from "./components/Callback";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SessionManager } from "./components/SessionManager";

function App() {
  return (
    <Router>
      <Route path="/login">
        <Login />
      </Route>
      
      <Route path="/callback">
        <Callback />
      </Route>
      
      <Route path="/">
        <ProtectedRoute>
          <SessionManager />
          <ChatbotApp />
        </ProtectedRoute>
      </Route>
    </Router>
  );
}

export default App;