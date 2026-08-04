/**
 * ThreadModel.cpp — thread_local identity storage.
 * Each thread calls ThreadModel::setCurrentThread() at startup.
 */
#include "ThreadModel.h"

namespace vibecore {
    thread_local ThreadId currentThreadId = ThreadId::Unknown;
} // namespace vibecore
