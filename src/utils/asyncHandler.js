const asyncHandler = (asyncFn) => {
    return (req, res, next) => {
        Promise.resolve(asyncFn(req, res, next)).catch((err) => {
            next(err);
        });
    };
};

export default asyncHandler;

//     Other Method

/* const asyncHandler = (fn) =>
    async (req, res, next) =>{
        try {
            await fn(req, res, next)
            
        } catch (error) {
            res.status(err.status || 500).json({
                success: false,
                message: err.message, 
            })
            
        }
    }
*/
