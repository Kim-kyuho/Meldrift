type Reply<T> = { resolve: (value: T) => void; reject: (error: Error) => void };

export class Replies<T> {
    private readonly pending = new Map<string, Reply<T>>();

    wait(id: string, timeout: number, timeoutMessage: string) {
        return new Promise<T>((resolve, reject) => {
            const finish = (callback: () => void) => {
                clearTimeout(timer);
                this.pending.delete(id);
                callback();
            };
            const timer = setTimeout(() => finish(() => reject(new Error(timeoutMessage))), timeout);
            this.pending.set(id, {
                resolve: (value) => finish(() => resolve(value)),
                reject: (error) => finish(() => reject(error)),
            });
        });
    }

    resolve(id: string, value: T) {
        this.pending.get(id)?.resolve(value);
    }

    reject(id: string, error: Error) {
        this.pending.get(id)?.reject(error);
    }

    clear(message: string) {
        const error = new Error(message);
        for (const reply of this.pending.values()) {
            reply.reject(error);
        }
    }
}
