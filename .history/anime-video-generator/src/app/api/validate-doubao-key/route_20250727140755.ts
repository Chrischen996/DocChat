import { NextRequest, NextResponse } from 'next/server';
import { DoubaoClient, MockDoubaoClient } from '@/lib/doubao-client';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    // Use mock client for development - replace with real client when Doubao API is available
    const client = new MockDoubaoClient(apiKey);
    
    try {
      const isValid = await client.validateApiKey();
      
      if (isValid) {
        return NextResponse.json({ 
          valid: true, 
          message: 'Doubao API key is valid' 
        });
      } else {
        return NextResponse.json(
          { valid: false, error: 'Invalid Doubao API key' },
          { status: 401 }
        );
      }

    } catch (error: any) {
      if (error.message?.includes('401') || 
          error.message?.includes('unauthorized') ||
          error.message?.includes('authentication')) {
        return NextResponse.json(
          { valid: false, error: 'Invalid Doubao API key' },
          { status: 401 }
        );
      }
      
      // For other errors, assume the key might be valid but there's another issue
      return NextResponse.json({ 
        valid: true, 
        message: 'Doubao API key appears to be valid' 
      });
    }

  } catch (error: any) {
    console.error('Doubao API key validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Failed to validate Doubao API key' },
      { status: 500 }
    );
  }
}
