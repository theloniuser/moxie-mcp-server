#!/usr/bin/env node

/**
 * Moxie MCP Server - Docker Version
 * Provides comprehensive integration with withmoxie.com API
 * 
 * Required environment variables:
 * - MOXIE_BASE_URL: Your workspace base URL (e.g., https://pod00.withmoxie.dev)
 * - MOXIE_API_KEY: Your API key from Workspace Settings > Connected Apps > Integrations
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

// Add startup logging
console.error('Starting Moxie MCP Server...');
console.error(`Node version: ${process.version}`);
console.error(`Environment: ${process.env.NODE_ENV || 'production'}`);

class MoxieServer {
  constructor() {
    this.baseUrl = process.env.MOXIE_BASE_URL;
    this.apiKey = process.env.MOXIE_API_KEY;

    if (!this.baseUrl || !this.apiKey) {
      console.error('ERROR: MOXIE_BASE_URL and MOXIE_API_KEY environment variables are required');
      console.error('Get these from Workspace Settings > Connected Apps > Integrations');
      process.exit(1);
    }

    // Ensure base URL format is correct
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
    if (!this.baseUrl.includes('/api/public')) {
      this.baseUrl = `${this.baseUrl}/api/public`;
    }

    // Client name → ID cache (loaded lazily by getClientMap)
    this.clientMapCache = null;

    console.error(`Moxie API configured: ${this.baseUrl.replace(this.apiKey, '***')}`);
  }

  async getClientMap() {
    if (this.clientMapCache) return this.clientMapCache;
    const clients = await this.listClients();
    const list = Array.isArray(clients) ? clients : (clients.clients || []);
    this.clientMapCache = {};
    for (const c of list) {
      if (c.id && c.name) this.clientMapCache[c.name] = c.id;
    }
    console.error(`Client map loaded: ${Object.keys(this.clientMapCache).length} clients`);
    return this.clientMapCache;
  }

  async makeRequest(endpoint, method = 'GET', body = null, isMultipart = false) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'X-API-KEY': this.apiKey,
        'Accept': 'application/json'
      }
    };

    if (body && !isMultipart) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    } else if (isMultipart) {
      options.body = body; // FormData
    }

    try {
      const response = await fetch(url, options);
      const text = await response.text();
      
      if (!response.ok) {
        throw new Error(`API Error (${response.status}): ${text}`);
      }
      
      return text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  // Client Management Tools
  async listClients() {
    return this.makeRequest('/action/clients/list', 'GET');
  }

  async searchClients(query) {
    const endpoint = query ? `/action/clients/search?query=${encodeURIComponent(query)}` : '/action/clients/search';
    return this.makeRequest(endpoint, 'GET');
  }

  async createClient(data) {
    return this.makeRequest('/action/clients/create', 'POST', data);
  }

  // Name Resolution Helpers
  async resolveProjectId(projectName) {
    const projects = await this.searchProjects(projectName);
    const list = Array.isArray(projects) ? projects : (projects.projects || []);
    const project = list.find(p => p.name === projectName);
    if (!project) throw new Error(`Project not found: "${projectName}". Use moxie_search_projects to find the exact name.`);
    return project.id;
  }

  async resolveVendorId(vendorName) {
    const vendors = await this.listVendorNames();
    const list = Array.isArray(vendors) ? vendors : (vendors.vendors || []);
    const vendor = list.find(v => v.name === vendorName);
    if (!vendor) throw new Error(`Vendor not found: "${vendorName}". Use moxie_list_vendors to find the exact name.`);
    return vendor.id;
  }

  async resolveInvoiceTemplateId(templateName) {
    const templates = await this.listInvoiceTemplates();
    const list = Array.isArray(templates) ? templates : (templates.templates || []);
    const template = list.find(t => t.name === templateName);
    if (!template) throw new Error(`Invoice template not found: "${templateName}". Use moxie_list_invoice_templates to find the exact name.`);
    return template.id;
  }

  async resolveFormId(formName) {
    const forms = await this.listFormNames();
    const list = Array.isArray(forms) ? forms : (forms.forms || []);
    const form = list.find(f => f.name === formName);
    if (!form) throw new Error(`Form not found: "${formName}". Use moxie_list_forms to find the exact name.`);
    return form.id;
  }

  // Contact Management Tools
  async searchContacts(query) {
    const endpoint = query ? `/action/contacts/search?query=${encodeURIComponent(query)}` : '/action/contacts/search';
    return this.makeRequest(endpoint, 'GET');
  }

  async createContact(data) {
    return this.makeRequest('/action/contacts/create', 'POST', data);
  }

  // Project Management Tools
  async searchProjects(clientName) {
    const endpoint = clientName ? `/action/projects/search?query=${encodeURIComponent(clientName)}` : '/action/projects/search';
    return this.makeRequest(endpoint, 'GET');
  }

  async createProject(data) {
    return this.makeRequest('/action/projects/create', 'POST', data);
  }

  // Task Management Tools
  async createTask(data) {
    return this.makeRequest('/action/tasks/create', 'POST', data);
  }

  async listProjectTaskStages() {
    return this.makeRequest('/action/projectTaskStages/list', 'GET');
  }

  // Invoice & Financial Tools
  async searchPayableInvoices(clientName) {
    const endpoint = clientName ? `/action/payableInvoices/search?query=${encodeURIComponent(clientName)}` : '/action/payableInvoices/search';
    return this.makeRequest(endpoint, 'GET');
  }

  async createInvoice(data) {
    return this.makeRequest('/action/invoices/create', 'POST', data);
  }

  async applyPayment(data) {
    return this.makeRequest('/action/invoices/applyPayment', 'POST', data);
  }

  async createExpense(data) {
    return this.makeRequest('/action/expenses/create', 'POST', data);
  }

  // Time Tracking
  async createTimeEntry(data) {
    return this.makeRequest('/action/timeEntries/create', 'POST', data);
  }

  // Ticket/Request Tools
  async searchTickets(data) {
    const params = new URLSearchParams();
    if (data.clientName) params.append('query', data.clientName);
    if (data.status) params.append('status', data.status);
    const query = params.toString();
    const endpoint = query ? `/action/tickets/search?${query}` : '/action/tickets/search';
    return this.makeRequest(endpoint, 'GET');
  }

  async createTicket(data) {
    return this.makeRequest('/action/tickets/create', 'POST', data);
  }

  async updateTicket(data) {
    return this.makeRequest('/action/tickets/update', 'POST', data);
  }

  async createTicketComment(data) {
    const body = {
      ticketNumber: data.ticketNumber,
      comment: data.comment,
      privateComment: data.isPrivate || false,
      userEmail: data.userEmail
    };
    return this.makeRequest('/action/tickets/comments/create', 'POST', body);
  }

  // Opportunity Tools
  async createOpportunity(data) {
    return this.makeRequest('/action/opportunities/create', 'POST', data);
  }

  async listPipelineStages() {
    return this.makeRequest('/action/pipelineStages/list', 'GET');
  }

  // Template & Form Tools
  async listEmailTemplates() {
    return this.makeRequest('/action/emailTemplates/list', 'GET');
  }

  async listInvoiceTemplates() {
    return this.makeRequest('/action/invoiceTemplates/list', 'GET');
  }

  async listFormNames() {
    return this.makeRequest('/action/forms/list', 'GET');
  }

  async createFormSubmission(data) {
    return this.makeRequest('/action/forms/submit', 'POST', data);
  }

  // Vendor & User Tools
  async listVendorNames() {
    return this.makeRequest('/action/vendors/list', 'GET');
  }

  async listWorkspaceUsers() {
    return this.makeRequest('/action/users/list', 'GET');
  }

  // Calendar Tools
  async createOrUpdateCalendarEvent(data) {
    return this.makeRequest('/action/calendar/createOrUpdate', 'POST', data);
  }

  // File Attachment Tools
  async attachFileFromUrl(data) {
    return this.makeRequest('/action/files/attachFromUrl', 'POST', data);
  }

  async attachFileMultipart(filePath, data) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    
    // Add other fields to form
    Object.keys(data).forEach(key => {
      form.append(key, data[key]);
    });

    return this.makeRequest('/action/files/attachMultipart', 'POST', form, true);
  }

  // Deliverable Tools
  async approveDeliverable(data) {
    return this.makeRequest('/action/deliverables/approve', 'POST', data);
  }
}

// Initialize MCP Server
const server = new Server(
  {
    name: 'moxie-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const moxieApi = new MoxieServer();

// Tool Definitions
const TOOLS = [
  // Client Management
  {
    name: 'moxie_list_clients',
    description: 'List all clients in your Moxie CRM',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listClients()
  },
  {
    name: 'moxie_search_clients',
    description: 'Search for clients by name or contact information',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for client name or contact info'
        }
      }
    },
    handler: async (args) => await moxieApi.searchClients(args.query)
  },
  {
    name: 'moxie_create_client',
    description: 'Create a new client in Moxie CRM',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Client name (required)' },
        email: { type: 'string', description: 'Client email' },
        phone: { type: 'string', description: 'Client phone' },
        address1: { type: 'string' },
        address2: { type: 'string' },
        city: { type: 'string' },
        locality: { type: 'string', description: 'State/Province' },
        postal: { type: 'string' },
        country: { type: 'string' },
        website: { type: 'string' },
        taxId: { type: 'string' },
        hourlyAmount: { type: 'number' },
        currency: { type: 'string', default: 'USD' },
        leadSource: { type: 'string' },
        customValues: { type: 'object', description: 'Custom field values' }
      },
      required: ['name']
    },
    handler: async (args) => await moxieApi.createClient(args)
  },

  // Contact Management
  {
    name: 'moxie_search_contacts',
    description: 'Search contacts by first name, last name, or email',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search string for first, last, or email'
        }
      }
    },
    handler: async (args) => await moxieApi.searchContacts(args.query)
  },
  {
    name: 'moxie_create_contact',
    description: 'Create a new contact for a client',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Exact match of client name (required)' },
        firstName: { type: 'string', description: 'Contact first name (required)' },
        lastName: { type: 'string', description: 'Contact last name (required)' },
        email: { type: 'string', description: 'Contact email (required)' },
        role: { type: 'string' },
        phone: { type: 'string' },
        mobile: { type: 'string' },
        notes: { type: 'string' },
        defaultContact: { type: 'boolean', default: false },
        invoiceContact: { type: 'boolean', default: false },
        portalAccess: { type: 'boolean', default: false }
      },
      required: ['clientName', 'firstName', 'lastName', 'email']
    },
    handler: async (args) => {
      const { clientName, firstName, lastName, ...rest } = args;
      // Moxie API uses 'first'/'last'/'clientName' (not firstName/lastName/clientId)
      return moxieApi.createContact({ clientName, first: firstName, last: lastName, ...rest });
    }
  },

  // Project Management
  {
    name: 'moxie_search_projects',
    description: 'Search for active projects, optionally filtered by client',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: {
          type: 'string',
          description: 'Optional client name filter'
        }
      }
    },
    handler: async (args) => await moxieApi.searchProjects(args.clientName)
  },
  {
    name: 'moxie_create_project',
    description: 'Create a new project',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Project name (required)' },
        clientName: { type: 'string', description: 'Exact match of client name (required)' },
        templateName: { type: 'string', description: 'Optional template name' },
        startDate: { type: 'string', format: 'date', description: 'YYYY-MM-DD format' },
        dueDate: { type: 'string', format: 'date', description: 'YYYY-MM-DD format' },
        portalAccess: { 
          type: 'string', 
          enum: ['None', 'Overview', 'Full access', 'Read only'],
          default: 'Read only' 
        },
        showTimeWorkedInPortal: { type: 'boolean', default: false },
        feeSchedule: {
          type: 'object',
          properties: {
            feeType: { 
              type: 'string', 
              enum: ['Hourly', 'Fixed Price', 'Retainer', 'Per Item'],
              description: 'Required when not using template'
            },
            amount: { type: 'number' },
            retainerSchedule: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
            estimateMax: { type: 'number' },
            estimateMin: { type: 'number' },
            retainerStart: { type: 'string', format: 'date' },
            retainerTiming: { type: 'string', enum: ['ADVANCED', 'ARREARS'] },
            retainerOverageRate: { type: 'number' },
            taxable: { type: 'boolean' }
          }
        }
      },
      required: ['name', 'clientName']
    },
    handler: async (args) => {
      const { templateName, ...projectData } = args;
      // Moxie API accepts clientName directly — no ID resolution needed
      let templateId;
      if (templateName) templateId = await moxieApi.resolveInvoiceTemplateId(templateName);
      return moxieApi.createProject({ ...projectData, ...(templateId && { templateId }) });
    }
  },

  // Task Management
  {
    name: 'moxie_create_task',
    description: 'Create a new task in project management',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name (required)' },
        clientName: { type: 'string', description: 'Exact match of client name (required)' },
        projectName: { type: 'string', description: 'Exact match of project name (required)' },
        status: { type: 'string', description: 'Task status' },
        description: { type: 'string' },
        dueDate: { type: 'string', format: 'date' },
        startDate: { type: 'string', format: 'date' },
        priority: { type: 'number', minimum: 1, maximum: 5 },
        tasks: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Subtasks list'
        },
        assignedTo: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of user emails to assign'
        },
        customValues: { type: 'object' }
      },
      required: ['name', 'clientName', 'projectName']
    },
    handler: async (args) => {
      // Moxie API accepts clientName and projectName directly — no ID resolution needed
      return moxieApi.createTask(args);
    }
  },
  {
    name: 'moxie_list_task_stages',
    description: 'List all project task stages/statuses',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listProjectTaskStages()
  },

  // Invoice & Financial
  {
    name: 'moxie_search_invoices',
    description: 'Search for payable invoices',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: {
          type: 'string',
          description: 'Optional client name filter'
        }
      }
    },
    handler: async (args) => await moxieApi.searchPayableInvoices(args.clientName)
  },
  {
    name: 'moxie_create_invoice',
    description: 'Create a new invoice',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Exact match of client name (required)' },
        invoiceNumber: { type: 'string' },
        templateName: { type: 'string', description: 'Must match an existing invoice template exactly' },
        dueDate: { type: 'string', format: 'date' },
        taxRate: { type: 'number' },
        discountPercent: { type: 'number' },
        paymentInstructions: { type: 'string' },
        items: {
          type: 'array',
          description: 'Required — line items for the invoice',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              quantity: { type: 'number' },
              rate: { type: 'number' },
              taxable: { type: 'boolean' },
              projectName: { type: 'string', description: 'Must match an existing project name on the client record exactly' }
            }
          }
        },
        sendTo: {
          type: 'object',
          description: 'Optional — omit to leave the invoice in DRAFT status',
          properties: {
            send: { type: 'boolean' },
            contacts: { type: 'array', items: { type: 'string' } },
            emailTemplateName: { type: 'string' }
          }
        }
      },
      required: ['clientName', 'items']
    },
    handler: async (args) => {
      // Moxie API accepts clientName directly — no ID resolution needed
      return moxieApi.createInvoice(args);
    }
  },
  {
    name: 'moxie_apply_payment',
    description: 'Apply payment to an invoice',
    inputSchema: {
      type: 'object',
      properties: {
        invoiceId: { type: 'string', description: 'Invoice ID (required)' },
        amount: { type: 'number', description: 'Payment amount (required)' },
        paymentDate: { type: 'string', format: 'date' },
        paymentMethod: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['invoiceId', 'amount']
    },
    handler: async (args) => await moxieApi.applyPayment(args)
  },
  {
    name: 'moxie_create_expense',
    description: 'Create an expense record',
    inputSchema: {
      type: 'object',
      properties: {
        date: { type: 'string', format: 'date-time', description: 'Expense date (required)' },
        amount: { type: 'number', description: 'Expense amount (required)' },
        currency: { type: 'string', default: 'USD', description: 'ISO 4217 currency code' },
        paid: { type: 'boolean', description: 'Whether expense is paid (required)' },
        reimbursable: { type: 'boolean', description: 'Whether eligible for reimbursement (required)' },
        markupPercentage: { type: 'number' },
        category: { type: 'string' },
        billNo: { type: 'string' },
        description: { type: 'string' },
        notes: { type: 'string' },
        vendor: { type: 'string', description: 'Exact match of vendor name' },
        clientName: { type: 'string', description: 'Exact match of client name' }
      },
      required: ['date', 'amount', 'currency', 'paid', 'reimbursable']
    },
    handler: async (args) => {
      const { vendor, ...expenseData } = args;
      // Moxie API accepts clientName directly — no ID resolution needed
      if (vendor) {
        const vendorId = await moxieApi.resolveVendorId(vendor);
        expenseData.vendorId = vendorId;
      }
      return moxieApi.createExpense(expenseData);
    }
  },

  // Time Tracking
  {
    name: 'moxie_create_time_entry',
    description: 'Create a time tracking entry',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Exact match of project name' },
        taskName: { type: 'string', description: 'Exact match of task name' },
        date: { type: 'string', format: 'date' },
        hours: { type: 'number', description: 'Hours worked (required)' },
        description: { type: 'string' },
        billable: { type: 'boolean', default: true },
        userEmail: { type: 'string', description: 'Email of user who worked' }
      },
      required: ['hours']
    },
    handler: async (args) => {
      const { projectName, ...timeData } = args;
      if (projectName) {
        const projectId = await moxieApi.resolveProjectId(projectName);
        timeData.projectId = projectId;
      }
      return moxieApi.createTimeEntry(timeData);
    }
  },

  // Tickets/Requests
  {
    name: 'moxie_list_tickets',
    description: 'List support tickets/requests, optionally filtered by client or status',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Filter by client name' },
        status: { type: 'string', description: 'Filter by status (e.g. Open, Closed)' }
      }
    },
    handler: async (args) => await moxieApi.searchTickets(args)
  },
  {
    name: 'moxie_create_ticket',
    description: 'Create a support ticket/request',
    inputSchema: {
      type: 'object',
      properties: {
        clientName: { type: 'string', description: 'Exact match of client name (required)' },
        contactEmail: { type: 'string', description: 'Email of an existing contact at this client — used to link the ticket. If omitted, the first available contact email is used.' },
        subject: { type: 'string', description: 'Ticket subject (required)' },
        description: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
        assignedTo: { type: 'string', description: 'User email to assign to' },
        requestType: { type: 'string' }
      },
      required: ['clientName', 'subject']
    },
    handler: async (args) => {
      const { clientName, contactEmail, description, ...ticketData } = args;
      // Moxie API links tickets to clients via userEmail (a contact's email), not clientId
      let userEmail = contactEmail;
      if (!userEmail) {
        // Look up the client's contacts and use the first available email
        const map = await moxieApi.getClientMap();
        const clientId = map[clientName];
        if (!clientId) throw new Error(`Client not found: "${clientName}". Use moxie_list_clients to find the exact name.`);
        const clients = await moxieApi.listClients();
        const list = Array.isArray(clients) ? clients : (clients.clients || []);
        const client = list.find(c => c.id === clientId);
        const contact = client && client.contacts && client.contacts.find(c => c.email);
        if (!contact) throw new Error(`No contacts found for client "${clientName}". Add a contact first or pass contactEmail.`);
        userEmail = contact.email;
      }
      const result = await moxieApi.createTicket({ ...ticketData, userEmail });
      // Moxie API does not support setting summary on creation — post description as initial comment instead
      if (description && result.ticket) {
        const { ticketNumber } = result.ticket;
        await moxieApi.createTicketComment({ ticketNumber, comment: description, userEmail, isPrivate: false });
      }
      return result;
    }
  },
  {
    name: 'moxie_add_ticket_comment',
    description: 'Add a comment to an existing ticket',
    inputSchema: {
      type: 'object',
      properties: {
        ticketNumber: { type: 'number', description: 'Ticket number (numeric, e.g. 1202) — required' },
        comment: { type: 'string', description: 'Comment text (required)' },
        userEmail: { type: 'string', description: 'Email of a recognized contact or team member (required)' },
        isPrivate: { type: 'boolean', default: false, description: 'Whether comment is internal only' }
      },
      required: ['ticketNumber', 'comment', 'userEmail']
    },
    handler: async (args) => await moxieApi.createTicketComment(args)
  },
  {
    name: 'moxie_update_ticket',
    description: 'Update fields on an existing ticket (subject, status, priority, due date, assigned user)',
    inputSchema: {
      type: 'object',
      properties: {
        ticketNumber: { type: 'number', description: 'Ticket number (numeric, e.g. 1207) — required' },
        subject: { type: 'string', description: 'Updated subject/title' },
        status: { type: 'string', description: 'New status (e.g. New, In Progress, Closed)' },
        priority: { type: 'string', enum: ['Low', 'Medium', 'High', 'Urgent'] },
        dueDate: { type: 'string', format: 'date', description: 'Due date in YYYY-MM-DD format' },
        assignedTo: { type: 'string', description: 'User email to assign to' }
      },
      required: ['ticketNumber']
    },
    handler: async (args) => await moxieApi.updateTicket(args)
  },

  // Opportunities
  {
    name: 'moxie_create_opportunity',
    description: 'Create a pipeline opportunity',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Opportunity name (required)' },
        clientName: { type: 'string', description: 'Exact match of client name' },
        value: { type: 'number' },
        stage: { type: 'string' },
        probability: { type: 'number', minimum: 0, maximum: 100 },
        expectedCloseDate: { type: 'string', format: 'date' },
        description: { type: 'string' },
        customValues: { type: 'object' }
      },
      required: ['name']
    },
    handler: async (args) => {
      // Moxie API accepts clientName directly — no ID resolution needed
      return moxieApi.createOpportunity(args);
    }
  },
  {
    name: 'moxie_list_pipeline_stages',
    description: 'List all pipeline stages',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listPipelineStages()
  },

  // Templates & Forms
  {
    name: 'moxie_list_email_templates',
    description: 'List all email templates',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listEmailTemplates()
  },
  {
    name: 'moxie_list_invoice_templates',
    description: 'List all invoice templates',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listInvoiceTemplates()
  },
  {
    name: 'moxie_list_forms',
    description: 'List all form names',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listFormNames()
  },
  {
    name: 'moxie_submit_form',
    description: 'Submit a form with data',
    inputSchema: {
      type: 'object',
      properties: {
        formName: { type: 'string', description: 'Exact match of form name (required)' },
        clientName: { type: 'string' },
        data: { type: 'object', description: 'Form field data' }
      },
      required: ['formName']
    },
    handler: async (args) => {
      const { formName, ...formData } = args;
      // Moxie API accepts clientName directly — no ID resolution needed
      const formId = await moxieApi.resolveFormId(formName);
      return moxieApi.createFormSubmission({ ...formData, formId });
    }
  },

  // Vendor & User Management
  {
    name: 'moxie_list_vendors',
    description: 'List all vendor names',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listVendorNames()
  },
  {
    name: 'moxie_list_users',
    description: 'List all workspace users and permissions',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => await moxieApi.listWorkspaceUsers()
  },

  // Calendar
  {
    name: 'moxie_calendar_event',
    description: 'Create or update a calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID for updates' },
        title: { type: 'string', description: 'Event title (required for create)' },
        startTime: { type: 'string', format: 'date-time' },
        endTime: { type: 'string', format: 'date-time' },
        description: { type: 'string' },
        location: { type: 'string' },
        clientName: { type: 'string' },
        projectName: { type: 'string' },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses of attendees'
        }
      }
    },
    handler: async (args) => {
      const { projectName, ...eventData } = args;
      // Moxie API accepts clientName directly — no ID resolution needed
      if (projectName) {
        const projectId = await moxieApi.resolveProjectId(projectName);
        eventData.projectId = projectId;
      }
      return moxieApi.createOrUpdateCalendarEvent(eventData);
    }
  },

  // File Attachments
  {
    name: 'moxie_attach_file_url',
    description: 'Attach a file from URL to an entity',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'File URL (required)' },
        entityType: { 
          type: 'string', 
          enum: ['client', 'project', 'task', 'invoice', 'ticket'],
          description: 'Entity type to attach to (required)'
        },
        entityId: { type: 'string', description: 'Entity ID (required)' },
        filename: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['url', 'entityType', 'entityId']
    },
    handler: async (args) => await moxieApi.attachFileFromUrl(args)
  },

  // Deliverables
  {
    name: 'moxie_approve_deliverable',
    description: 'Approve a deliverable/task',
    inputSchema: {
      type: 'object',
      properties: {
        deliverableId: { type: 'string', description: 'Deliverable/Task ID (required)' },
        comments: { type: 'string' }
      },
      required: ['deliverableId']
    },
    handler: async (args) => await moxieApi.approveDeliverable(args)
  }
];

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }))
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = TOOLS.find(t => t.name === request.params.name);
  
  if (!tool) {
    throw new McpError(
      ErrorCode.MethodNotFound,
      `Unknown tool: ${request.params.name}`
    );
  }
  
  try {
    const result = await tool.handler(request.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error.message}`
    );
  }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Moxie MCP Server running on stdio transport');
  console.error('Ready to accept connections from Claude Desktop');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
