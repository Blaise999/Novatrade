// Support Tickets API
// GET /api/support - Get user's tickets
// POST /api/support - Create new ticket
// GET /api/support/[id] - Get ticket with messages
// POST /api/support/[id]/messages - Add message to ticket

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ============================================
// Types
// ============================================

type TicketCategory = 'general' | 'deposit' | 'withdrawal' | 'trading' | 'kyc' | 'technical' | 'account';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';

// ============================================
// GET /api/support - Get user's tickets
// ============================================

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const { searchParams } = request.nextUrl;
    const ticketId = searchParams.get('ticketId');
    const status = searchParams.get('status');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }
    
    // If ticketId provided, get single ticket with messages
    if (ticketId) {
      const { data: ticket, error: ticketError } = await supabaseAdmin
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('user_id', userId)
        .single();
      
      if (ticketError || !ticket) {
        return NextResponse.json(
          { success: false, error: 'Ticket not found' },
          { status: 404 }
        );
      }
      
      // Get messages for this ticket
      const { data: messages, error: msgError } = await supabaseAdmin
        .from('support_messages')
        .select(`
          id,
          message,
          sender_type,
          attachments,
          read_at,
          created_at,
          sender:sender_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      
      if (msgError) {
        console.error('[Support API] Messages fetch error:', msgError);
      }
      
      // Mark unread messages as read
      await supabaseAdmin
        .from('support_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('ticket_id', ticketId)
        .neq('sender_id', userId)
        .is('read_at', null);
      
      return NextResponse.json({
        success: true,
        ticket: {
          ...ticket,
          messages: messages || [],
        },
      });
    }
    
    // Get all tickets for user
    let query = supabaseAdmin
      .from('support_tickets')
      .select(`
        id,
        subject,
        category,
        priority,
        status,
        created_at,
        updated_at,
        resolved_at
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data: tickets, error } = await query;
    
    if (error) {
      console.error('[Support API] Fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Get unread count for each ticket
    const ticketsWithUnread = await Promise.all(
      (tickets || []).map(async (ticket) => {
        const { count } = await supabaseAdmin
          .from('support_messages')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', ticket.id)
          .neq('sender_id', userId)
          .is('read_at', null);
        
        return {
          ...ticket,
          unreadCount: count || 0,
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      tickets: ticketsWithUnread,
      count: ticketsWithUnread.length,
    });
  } catch (error: any) {
    console.error('[Support API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/support - Create ticket or add message
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      );
    }
    
    // Add message to existing ticket
    if (action === 'message') {
      const { ticketId, message, attachments } = body;
      
      if (!ticketId || !message) {
        return NextResponse.json(
          { success: false, error: 'ticketId and message required' },
          { status: 400 }
        );
      }
      
      // Verify user owns this ticket
      const { data: ticket } = await supabaseAdmin
        .from('support_tickets')
        .select('id, status')
        .eq('id', ticketId)
        .eq('user_id', userId)
        .single();
      
      if (!ticket) {
        return NextResponse.json(
          { success: false, error: 'Ticket not found' },
          { status: 404 }
        );
      }
      
      if (ticket.status === 'closed') {
        return NextResponse.json(
          { success: false, error: 'Cannot reply to closed ticket' },
          { status: 400 }
        );
      }
      
      // Add message
      const { data: newMessage, error: msgError } = await supabaseAdmin
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: userId,
          sender_type: 'user',
          message: message.trim(),
          attachments: attachments || [],
        })
        .select()
        .single();
      
      if (msgError) {
        return NextResponse.json(
          { success: false, error: msgError.message },
          { status: 500 }
        );
      }
      
      // Update ticket status if it was waiting for user
      if (ticket.status === 'waiting_user') {
        await supabaseAdmin
          .from('support_tickets')
          .update({
            status: 'in_progress',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ticketId);
      } else {
        await supabaseAdmin
          .from('support_tickets')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', ticketId);
      }
      
      return NextResponse.json({
        success: true,
        message: newMessage,
      });
    }
    
    // Create new ticket
    const { subject, category, priority, message } = body;
    
    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Subject and message required' },
        { status: 400 }
      );
    }
    
    // Validate category
    const validCategories: TicketCategory[] = ['general', 'deposit', 'withdrawal', 'trading', 'kyc', 'technical', 'account'];
    const ticketCategory: TicketCategory = validCategories.includes(category) ? category : 'general';
    
    // Validate priority
    const validPriorities: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];
    const ticketPriority: TicketPriority = validPriorities.includes(priority) ? priority : 'normal';
    
    // Create ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .insert({
        user_id: userId,
        subject: subject.trim(),
        category: ticketCategory,
        priority: ticketPriority,
        status: 'open',
      })
      .select()
      .single();
    
    if (ticketError) {
      console.error('[Support API] Ticket creation error:', ticketError);
      return NextResponse.json(
        { success: false, error: ticketError.message },
        { status: 500 }
      );
    }
    
    // Add initial message
    const { data: initialMessage, error: msgError } = await supabaseAdmin
      .from('support_messages')
      .insert({
        ticket_id: ticket.id,
        sender_id: userId,
        sender_type: 'user',
        message: message.trim(),
      })
      .select()
      .single();
    
    if (msgError) {
      console.error('[Support API] Initial message error:', msgError);
      // Don't fail - ticket was created
    }
    
    console.log(`[Support API] New ticket created: ${ticket.id} - ${subject}`);
    
    return NextResponse.json({
      success: true,
      ticket: {
        ...ticket,
        messages: initialMessage ? [initialMessage] : [],
      },
    });
  } catch (error: any) {
    console.error('[Support API] POST Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create ticket' },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/support - Update ticket status
// ============================================

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, ticketId, status } = body;
    
    if (!userId || !ticketId) {
      return NextResponse.json(
        { success: false, error: 'userId and ticketId required' },
        { status: 400 }
      );
    }
    
    // Users can only close their own tickets
    if (status && status !== 'closed') {
      return NextResponse.json(
        { success: false, error: 'Users can only close tickets' },
        { status: 403 }
      );
    }
    
    // Verify ownership
    const { data: ticket } = await supabaseAdmin
      .from('support_tickets')
      .select('id')
      .eq('id', ticketId)
      .eq('user_id', userId)
      .single();
    
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }
    
    // Update status
    const { data: updatedTicket, error } = await supabaseAdmin
      .from('support_tickets')
      .update({
        status: 'closed',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketId)
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    // Add system message
    await supabaseAdmin
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: userId,
        sender_type: 'system',
        message: 'Ticket closed by user.',
      });
    
    return NextResponse.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error: any) {
    console.error('[Support API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update ticket' },
      { status: 500 }
    );
  }
}
