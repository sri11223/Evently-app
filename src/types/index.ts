// src/types/index.ts
export interface User {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
    created_at: Date;
}

export interface Event {
    id: string;
    name: string;
    description?: string;
    venue: string;
    event_date: Date;
    total_capacity: number;
    available_seats: number;
    price: number;
    status: 'active' | 'cancelled' | 'completed';
    version: number;
    created_at: Date;
}

export interface Booking {
    id: string;
    user_id: string;
    event_id: string;
    quantity: number;
    total_amount: number;
    status: 'confirmed' | 'cancelled' | 'refunded';
    booking_reference: string;
    version: number;
    created_at: Date;
}

export interface BookingRequest {
    user_id: string;
    event_id: string;
    quantity: number;
}
