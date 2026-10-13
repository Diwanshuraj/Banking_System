package com.banking.core;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;

/** Generic collection helpers used by the reports. */
public final class Rankings {

    private Rankings() {
    }

    /**
     * The {@code n} largest items by {@code order}, largest first. Uses a min-heap of size {@code n},
     * so it is O(size log n) and never sorts the whole collection.
     */
    public static <T> List<T> topN(Collection<? extends T> items, int n, Comparator<? super T> order) {
        if (n <= 0) return List.of();
        PriorityQueue<T> heap = new PriorityQueue<>(n + 1, order);
        for (T item : items) {
            heap.offer(item);
            if (heap.size() > n) heap.poll();
        }
        List<T> result = new ArrayList<>(heap);
        result.sort(order.reversed());
        return result;
    }
}
