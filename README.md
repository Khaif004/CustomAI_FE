# Joule Replacement - AI Agent System

Complete AI agent system to replace SAP Joule using LangChain, FastAPI, and React.

## 📋 Project Overview

This project provides a multi-agent AI system for SAP BTP development assistance with:

- **Multi-Agent Architecture**: Specialized agents for different tasks (Developer, Data Analyst, Architect, Documentation)
- **Knowledge Base**: RAG implementation with FAISS vector store
- **REST API**: FastAPI backend with async support
- **Modern UI**: React frontend with TypeScript
- **BTP Integration**: Ready for Cloud Foundry deployment

## 🏗️ Project Structure

```
codebase/
├── backend/                 # FastAPI + LangChain backend
│   ├── app/
│   │   ├── main.py         # Application entry point
│   │   ├── config/         # Configuration
│   │   ├── api/            # REST API routes
│   │   ├── agents/         # AI agents
│   │   ├── tools/          # Custom tools
│   │   ├── knowledge/      # Vector store & RAG
│   │   ├── models/         # Pydantic models
│   │   └── utils/          # Utilities
│   ├── requirements.txt    # Python dependencies
│   ├── .env.example       # Environment template
│   └── README.md          # Backend documentation
│
├── frontend/               # React + TypeScript frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md          # Frontend documentation
│
└── README.md              # This file
```

## 🚀 Quick Start

### Backend Setup

1. **Navigate to backend**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   
   # Activate
   # Windows:
   venv\Scripts\activate
   
   # macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   # Copy example env file
   copy .env.example .env  # Windows
   cp .env.example .env    # macOS/Linux
   
   # Edit .env and add your OpenAI API key
   ```

5. **Run backend**
   ```bash
   python -m app.main
   ```

   Backend will be available at: http://localhost:8000

### Frontend Setup

1. **Navigate to frontend**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

   Frontend will be available at: http://localhost:3000

## 🔧 Development

### Backend Development

```bash
cd backend

# Run with auto-reload
uvicorn app.main:app --reload

# View API docs
# Open http://localhost:8000/docs
```

### Frontend Development

```bash
cd frontend

# Start dev server
npm start

# Build for production
npm run build

# Run tests
npm test
```

## 📚 Documentation

Comprehensive documentation is available in the `Documents/` folder:

- **[Main README](../Documents/README.md)** - Complete project overview and roadmap
- **[Technology Comparison](../Documents/01-Technology-Comparison.md)** - SAP AI Core vs LangChain
- **[Architecture Deep Dive](../Documents/02-Architecture-Deep-Dive.md)** - System architecture
- **[Quick Start Guide](../Documents/03-Quick-Start-Guide.md)** - Step-by-step tutorial
- **[Deployment Guide](../Documents/04-Deployment-Guide.md)** - BTP deployment instructions

## 🎯 Key Features

### Multi-Agent System
- **Router Agent**: Analyzes queries and delegates to specialists
- **Developer Agent**: Code analysis and development assistance
- **Data Analyst Agent**: Database queries and data insights
- **Architecture Expert**: System design and diagrams
- **Documentation Agent**: Auto-generate documentation

### Knowledge Base (RAG)
- Vector embeddings with FAISS
- Semantic search across project documentation
- Context-aware responses
- Incremental updates

### API Features
- RESTful endpoints
- WebSocket support for real-time chat
- JWT authentication
- Rate limiting
- CORS configuration

### Frontend Features
- Modern React UI with TypeScript
- Real-time chat interface
- Code syntax highlighting
- Diagram rendering (Mermaid)
- Project context switching

## 🔐 Environment Variables

### Backend (.env)

```bash
# LLM
OPENAI_API_KEY=your_key_here

# Application
APP_NAME=JouleReplacement
DEBUG=true
PORT=8000

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Optional: HANA Cloud
HANA_HOST=your-host
HANA_USER=your-user
HANA_PASSWORD=your-password
```

### Frontend (.env)

```bash
REACT_APP_API_URL=http://localhost:8000
```

## 🧪 Testing

### Backend Tests

```bash
cd backend
pytest
pytest --cov=app tests/
```

### Frontend Tests

```bash
cd frontend
npm test
npm test -- --coverage
```

## 📦 Deployment

### Deploy to SAP BTP Cloud Foundry

1. **Backend deployment**
   ```bash
   cd backend
   cf push
   ```

2. **Frontend deployment**
   ```bash
   cd frontend
   npm run build
   cf push
   ```

See [Deployment Guide](../Documents/04-Deployment-Guide.md) for detailed instructions.

## 💰 Cost Estimation

- **LLM (OpenAI)**: $10-50/month
- **Cloud Foundry**: €30-50/month
- **Total**: €40-100/month

Compare to Joule's premium subscription pricing.

## 🗺️ Development Roadmap

- [x] Project structure setup
- [x] Backend foundation (FastAPI + LangChain)
- [x] Frontend foundation (React + TypeScript)
- [ ] Implement Router Agent
- [ ] Implement specialized agents
- [ ] Add RAG with FAISS
- [ ] Create API endpoints
- [ ] Build chat UI
- [ ] Add authentication
- [ ] BTP service integration
- [ ] Deploy to Cloud Foundry

## 🤝 Contributing

1. Follow the architecture in `Documents/02-Architecture-Deep-Dive.md`
2. Implement features according to the roadmap
3. Add tests for new functionality
4. Update documentation

## 📝 Next Steps

1. **For Developers**:
   - Review [Architecture Guide](../Documents/02-Architecture-Deep-Dive.md)
   - Start with [Quick Start Guide](../Documents/03-Quick-Start-Guide.md)
   - Implement agents in `backend/app/agents/`

2. **For Deployment**:
   - Follow [Deployment Guide](../Documents/04-Deployment-Guide.md)
   - Set up BTP account and Cloud Foundry
   - Configure environment variables

3. **For Learning**:
   - Review prerequisites in main [README](../Documents/README.md)
   - Study LangChain documentation
   - Explore agent examples

## 🐛 Troubleshooting

### Common Issues

1. **Backend won't start**: Check Python version (3.9+) and virtual environment
2. **Frontend errors**: Clear node_modules and reinstall (`npm install`)
3. **API connection issues**: Verify CORS settings and API URL
4. **LLM errors**: Check OpenAI API key in .env

## 📞 Support

- Documentation: `Documents/` folder
- Backend README: `backend/README.md`
- Frontend README: `frontend/README.md`

---

**Version**: 0.1.0  
**Last Updated**: March 14, 2026  
**Tech Stack**: Python 3.9+, FastAPI, LangChain, React 18, TypeScript